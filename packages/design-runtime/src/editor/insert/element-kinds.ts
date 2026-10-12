/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInsertElementKinds(
  runtime: RuntimeBindings,
): () => void {
  var InsertElementKindsSubscribers: Dynamic;
  var InsertElementKindsSvgRectCircleSet: Dynamic;
  var InsertElementKindsSubscribers_2: Dynamic;
  var InsertElementKindsPathLinePolylineSet: Dynamic;
  var InsertElementKindsEvery: Dynamic;
  function classifyElementStyleKind(input?: Dynamic): Dynamic {
    let value: Dynamic = input.toLowerCase();
    return InsertElementKindsSubscribers.has(value)
      ? "text"
      : value === "img"
        ? "image"
        : InsertElementKindsPathLinePolylineSet.has(value)
          ? "line"
          : InsertElementKindsSvgRectCircleSet.has(value)
            ? "shape"
            : InsertElementKindsSubscribers_2.has(value)
              ? "box"
              : "other";
  }
  function isTextCapableElement(element?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = element.tagName.toLowerCase();
    return InsertElementKindsSubscribers.has(value) ||
      (InsertElementKindsSubscribers_2.has(value) && options) ||
      (value === "div" &&
        element.children.length === 1 &&
        /^(ul|ol)$/i.test(element.children[0].tagName) &&
        [...element.children[0].children].every(
          (input?: Dynamic): Dynamic =>
            /^li$/i.test(input.tagName) && InsertElementKindsEvery(input),
        ))
      ? "text"
      : value === "img"
        ? "image"
        : InsertElementKindsPathLinePolylineSet.has(value) ||
            (value === "svg" &&
              ((/(^|;)\s*fill:\s*none/.test(
                element.getAttribute("style") ?? "",
              ) &&
                element.querySelector("rect,circle,ellipse,polygon") ===
                  null) ||
                (0, runtime.inspectSvgArrow)(element) !== null))
          ? "line"
          : InsertElementKindsSvgRectCircleSet.has(value)
            ? "shape"
            : InsertElementKindsSubscribers_2.has(value)
              ? "box"
              : "other";
  }
  bindRuntimeValue(
    runtime,
    "InsertElementKindsSubscribers",
    () => InsertElementKindsSubscribers,
    (value) => {
      InsertElementKindsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InsertElementKindsSvgRectCircleSet",
    () => InsertElementKindsSvgRectCircleSet,
    (value) => {
      InsertElementKindsSvgRectCircleSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InsertElementKindsSubscribers_2",
    () => InsertElementKindsSubscribers_2,
    (value) => {
      InsertElementKindsSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InsertElementKindsPathLinePolylineSet",
    () => InsertElementKindsPathLinePolylineSet,
    (value) => {
      InsertElementKindsPathLinePolylineSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InsertElementKindsEvery",
    () => InsertElementKindsEvery,
    (value) => {
      InsertElementKindsEvery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyElementStyleKind",
    () => classifyElementStyleKind,
  );
  bindRuntimeValue(runtime, "isTextCapableElement", () => isTextCapableElement);
  return () => {
    InsertElementKindsSubscribers = new Set([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "button",
      "label",
      "li",
      "blockquote",
      "td",
      "th",
      "dt",
      "dd",
      "caption",
      "figcaption",
      "pre",
      "time",
      ...runtime.HtmlTagNormalizationSubscribers,
    ]);
    InsertElementKindsSvgRectCircleSet = new Set([
      "svg",
      "rect",
      "circle",
      "ellipse",
      "polygon",
    ]);
    InsertElementKindsSubscribers_2 = new Set([
      "div",
      "section",
      "article",
      "header",
      "footer",
      "nav",
      "main",
      "aside",
      "ul",
      "ol",
      "table",
      "tr",
      "thead",
      "tbody",
      "form",
      "figure",
      "details",
      "summary",
      "fieldset",
      "dl",
    ]);
    InsertElementKindsPathLinePolylineSet = new Set([
      "path",
      "line",
      "polyline",
      "hr",
    ]);
    InsertElementKindsEvery = (input?: Dynamic): Dynamic =>
      [...input.querySelectorAll("*")].every(
        (input2?: Dynamic): Dynamic =>
          runtime.HtmlTagNormalizationSubscribers.has(
            input2.tagName.toLowerCase(),
          ),
      );
  };
}
