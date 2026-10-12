/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSelectionElementOrder(
  runtime: RuntimeBindings,
): () => void {
  var selectedRootElementIds: Dynamic;
  var selectedElementsInDocumentOrder: Dynamic;
  function promoteSvgShapeToRoot(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.element(options);
    if (!value || !runtime.svgShapeTags.has(value.tagName.toLowerCase()))
      return options;
    let ancestor: Dynamic = value.closest("svg");
    if (!ancestor) return options;
    let value2: Dynamic = parseInt(
      ancestor.getAttribute("data-dc-tpl") ?? "-1",
      10,
    );
    return value2 >= 0 ? value2 : options;
  }
  function containsUneditableSelection(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return options.some(
      (input2?: Dynamic): Dynamic =>
        input.element(input2) == null || input.isLoopDriven(input2),
    );
  }
  function copySelectedElementsHtml(input?: Dynamic, items?: Dynamic): Dynamic {
    if (items.length === 0 || containsUneditableSelection(input, items))
      return null;
    let value: Dynamic = selectedRootElementIds(input, [
      ...new Set(
        items.map(
          (input2?: Dynamic): Dynamic => promoteSvgShapeToRoot(input, input2),
        ),
      ),
    ])
      .map((input2?: Dynamic): Dynamic => input.subtreeHtml(input2))
      .filter((input2?: Dynamic): Dynamic => input2 != null);
    return value.length === 0
      ? null
      : value.join(`
`);
  }
  bindRuntimeValue(
    runtime,
    "selectedRootElementIds",
    () => selectedRootElementIds,
    (value) => {
      selectedRootElementIds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectedElementsInDocumentOrder",
    () => selectedElementsInDocumentOrder,
    (value) => {
      selectedElementsInDocumentOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "promoteSvgShapeToRoot",
    () => promoteSvgShapeToRoot,
  );
  bindRuntimeValue(
    runtime,
    "containsUneditableSelection",
    () => containsUneditableSelection,
  );
  bindRuntimeValue(
    runtime,
    "copySelectedElementsHtml",
    () => copySelectedElementsHtml,
  );
  return () => {
    selectedRootElementIds = (input?: Dynamic, options?: Dynamic): Dynamic =>
      options.filter(
        (input2?: Dynamic): Dynamic =>
          !options.some(
            (input3?: Dynamic): Dynamic =>
              input3 !== input2 && input.isWithin(input3, input2),
          ),
      );
    selectedElementsInDocumentOrder = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      options
        .map(
          (input2?: Dynamic): Dynamic => ({
            t: input2,
            e: input.element(input2),
          }),
        )
        .filter((input2?: Dynamic): Dynamic => input2.e != null)
        .sort(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            input2.e.compareDocumentPosition(options2.e) &
            Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
        )
        .map((input2?: Dynamic): Dynamic => input2.t);
  };
}
