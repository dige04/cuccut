/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelLabels(runtime: RuntimeBindings): () => void {
  var ModelLabelsTextHeadingParagraphSet: Dynamic;
  var ModelLabelsSubscribers: Dynamic;
  function readableTagName(input?: Dynamic): Dynamic {
    return Object.hasOwn(runtime.HtmlTagNormalizationFromEntriesValue, input)
      ? runtime.HtmlTagNormalizationFromEntriesValue[input]
      : input;
  }
  function tagIcon(input?: Dynamic): Dynamic {
    return Object.hasOwn(runtime.ModelDomTextRegistry, input)
      ? runtime.ModelDomTextRegistry[input]
      : undefined;
  }
  function detectContainerLayout(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input.children.length === 0) return null;
    let value: Dynamic = (
      (0, runtime.getStyleProperty)(options, "display") ?? ""
    ).trim();
    return value === "flex" || value === "inline-flex"
      ? ((0, runtime.getStyleProperty)(options, "flex-direction") ?? "")
          .trim()
          .startsWith("column")
        ? "column"
        : "row"
      : value === "grid" || value === "inline-grid"
        ? "grid"
        : null;
  }
  function labelToElementKind(input?: Dynamic, options?: Dynamic): Dynamic {
    if (ModelLabelsTextHeadingParagraphSet.has(input)) return "text";
    if (input === "Link") return "link";
    if (input === "Image") return "image";
    if (input === "Table") return "table";
    if (input === "Component") return "component";
    if (input === "Rectangle") return "rect";
    if (input === "Oval") return "oval";
    if (input === "Line") return "line";
    if (ModelLabelsSubscribers.has(input)) return options ?? "frame";
  }
  function isImportedIcon(element?: Dynamic): Dynamic {
    let value: Dynamic = element.tagName.toLowerCase();
    return value !== "x-import" && value !== "dc-import"
      ? false
      : (
          (element.getAttribute("from") ?? "") +
          " " +
          (element.getAttribute("component-from-global-scope") ?? "") +
          " " +
          (element.getAttribute("component") ?? "")
        )
          .toLowerCase()
          .includes("deck-stage");
  }
  function slideElementLabel(element?: Dynamic): Dynamic {
    let value: Dynamic = (element.getAttribute("data-deck-slide") ?? "").trim();
    if (/^\d+$/.test(value)) return `Slide ${parseInt(value, 10) + 1}`;
    let parentElement: Dynamic = element.parentElement;
    if (!parentElement || parentElement.tagName.toLowerCase() !== "deck-stage")
      return null;
    let value2: Dynamic =
        /^(template|script|style|sc-raw-script|sc-raw-style|sc-helmet)$/,
      index: Dynamic = 0;
    for (let value3 of parentElement.children as Dynamic)
      if (!value2.test(value3.tagName.toLowerCase())) {
        if (value3 === element) return `Slide ${index + 1}`;
        index++;
      }
    return null;
  }
  function isDeckStageElement(element?: Dynamic): Dynamic {
    let value: Dynamic = element.tagName.toLowerCase();
    return (
      value === "deck-stage" ||
      (value === "x-import" &&
        element.getAttribute("component-from-global-scope") === "deck-stage")
    );
  }
  function getDropContainer(input?: Dynamic, options?: Dynamic): Dynamic {
    if (!input || options === "root-end") return null;
    let value: Dynamic =
      options === "into" ? input : (input.parentElement ?? null);
    if (!value) return null;
    let parentElement: Dynamic = value.parentElement,
      value2: Dynamic = parentElement?.parentElement ?? null,
      value3: Dynamic = null,
      value4: Dynamic = null;
    parentElement && isDeckStageElement(parentElement)
      ? ((value3 = parentElement), (value4 = value))
      : parentElement &&
        value2 &&
        isDeckStageElement(value2) &&
        ((value3 = value2), (value4 = parentElement));
    return !value3 || !value4
      ? null
      : {
          w: parseInt(value3.getAttribute("width") ?? "", 10) || 1920,
          h: parseInt(value3.getAttribute("height") ?? "", 10) || 1080,
          slide: value4,
        };
  }
  bindRuntimeValue(runtime, "readableTagName", () => readableTagName);
  bindRuntimeValue(runtime, "tagIcon", () => tagIcon);
  bindRuntimeValue(
    runtime,
    "detectContainerLayout",
    () => detectContainerLayout,
  );
  bindRuntimeValue(
    runtime,
    "ModelLabelsTextHeadingParagraphSet",
    () => ModelLabelsTextHeadingParagraphSet,
    (value) => {
      ModelLabelsTextHeadingParagraphSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelLabelsSubscribers",
    () => ModelLabelsSubscribers,
    (value) => {
      ModelLabelsSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "labelToElementKind", () => labelToElementKind);
  bindRuntimeValue(runtime, "isImportedIcon", () => isImportedIcon);
  bindRuntimeValue(runtime, "slideElementLabel", () => slideElementLabel);
  bindRuntimeValue(runtime, "isDeckStageElement", () => isDeckStageElement);
  bindRuntimeValue(runtime, "getDropContainer", () => getDropContainer);
  return () => {
    ModelLabelsTextHeadingParagraphSet = new Set([
      "Text",
      "Heading",
      "Paragraph",
    ]);
    ModelLabelsSubscribers = new Set([
      "Section",
      "Article",
      "Header",
      "Footer",
      "Nav",
      "Aside",
      "Main",
      "Form",
      "List",
      "List item",
      "Figure",
      "Quote",
      "group",
      "Row",
      "Column",
      "Grid",
      "Conditional group",
      "Repeating group",
    ]);
  };
}
