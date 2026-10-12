/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSelectionTreeNavigation(
  runtime: RuntimeBindings,
): () => void {
  var SelectionTreeNavigationHelmetScHelmetPattern: Dynamic;
  var SelectionTreeNavigationTest: Dynamic;
  var SelectionTreeNavigationFilter: Dynamic;
  var SelectionTreeNavigationHandler: Dynamic;
  function clientPointToArtboard(
    clientX?: Dynamic,
    clientY?: Dynamic,
    artboardRect?: Dynamic,
    frameWidth?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      typeof input == "number" &&
      Number.isFinite(input) &&
      Math.abs(input) < 1e6;
    if (!callback(clientX) || !callback(clientY)) return null;
    let value: Dynamic = frameWidth ? artboardRect.width / frameWidth : 1;
    return {
      x: Math.min(
        artboardRect.right,
        Math.max(artboardRect.left, clientX * value + artboardRect.left),
      ),
      y: Math.min(
        artboardRect.bottom,
        Math.max(artboardRect.top, clientY * value + artboardRect.top),
      ),
    };
  }
  function navigableChildIds(input?: Dynamic, options?: Dynamic): Dynamic {
    return input
      .childTids(options)
      .filter(
        (input2?: Dynamic): Dynamic =>
          SelectionTreeNavigationTest(input, input2),
      );
  }
  function selectionChildren(input?: Dynamic, options?: Dynamic): Dynamic {
    return SelectionTreeNavigationHandler(
      SelectionTreeNavigationFilter(input, options).flatMap(
        (input2?: Dynamic): Dynamic => navigableChildIds(input, input2),
      ),
    );
  }
  function selectionParents(input?: Dynamic, options?: Dynamic): Dynamic {
    return SelectionTreeNavigationHandler(
      SelectionTreeNavigationFilter(input, options)
        .map((input2?: Dynamic): Dynamic => input.parentTid(input2))
        .filter((input2?: Dynamic): Dynamic => input2 != null),
    );
  }
  function selectionAdjacentSiblings(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return SelectionTreeNavigationHandler(
      SelectionTreeNavigationFilter(input, options).map(
        (input2?: Dynamic): Dynamic => {
          let value: Dynamic = navigableChildIds(
              input,
              input.parentTid(input2),
            ),
            value2: Dynamic = value.indexOf(input2);
          return value2 < 0 || value.length < 2
            ? input2
            : value[
                (value2 + (context === "next" ? 1 : value.length - 1)) %
                  value.length
              ];
        },
      ),
    );
  }
  function selectionSiblingIds(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = SelectionTreeNavigationFilter(input, options)[0];
    return navigableChildIds(
      input,
      value == null ? null : input.parentTid(value),
    );
  }
  function promotedSvgSelection(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = SelectionTreeNavigationFilter(input, options),
      value2: Dynamic = SelectionTreeNavigationHandler(
        value.map(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.promoteSvgShapeToRoot)(input, input2),
        ),
      ),
      value3: Dynamic =
        value2.length !== value.length ||
        value2.some(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            input2 !== value[options2],
        );
    return {
      targets: value2,
      promoted: value3,
    };
  }
  bindRuntimeValue(
    runtime,
    "clientPointToArtboard",
    () => clientPointToArtboard,
  );
  bindRuntimeValue(
    runtime,
    "SelectionTreeNavigationHelmetScHelmetPattern",
    () => SelectionTreeNavigationHelmetScHelmetPattern,
    (value) => {
      SelectionTreeNavigationHelmetScHelmetPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionTreeNavigationTest",
    () => SelectionTreeNavigationTest,
    (value) => {
      SelectionTreeNavigationTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionTreeNavigationFilter",
    () => SelectionTreeNavigationFilter,
    (value) => {
      SelectionTreeNavigationFilter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionTreeNavigationHandler",
    () => SelectionTreeNavigationHandler,
    (value) => {
      SelectionTreeNavigationHandler = value;
    },
  );
  bindRuntimeValue(runtime, "navigableChildIds", () => navigableChildIds);
  bindRuntimeValue(runtime, "selectionChildren", () => selectionChildren);
  bindRuntimeValue(runtime, "selectionParents", () => selectionParents);
  bindRuntimeValue(
    runtime,
    "selectionAdjacentSiblings",
    () => selectionAdjacentSiblings,
  );
  bindRuntimeValue(runtime, "selectionSiblingIds", () => selectionSiblingIds);
  bindRuntimeValue(runtime, "promotedSvgSelection", () => promotedSvgSelection);
  return () => {
    SelectionTreeNavigationHelmetScHelmetPattern =
      /^(helmet|sc-helmet|script|style|link|noscript|template)$/i;
    SelectionTreeNavigationTest = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      !SelectionTreeNavigationHelmetScHelmetPattern.test(
        input.tagName(options) ?? "",
      );
    SelectionTreeNavigationFilter = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      options.filter(
        (input2?: Dynamic): Dynamic => input.element(input2) != null,
      );
    SelectionTreeNavigationHandler = (input?: Dynamic): Dynamic => [
      ...new Set(input),
    ];
  };
}
