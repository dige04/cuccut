/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditElementTargets(
  runtime: RuntimeBindings,
): () => void {
  var STRUCTURAL_LEAF_ELEMENT_TAGS: Dynamic;
  var pickTargetAppearanceContext: Dynamic;
  var pickTargetSiblingContext: Dynamic;
  var readTemplateLoopHtml: Dynamic;
  var LEAF_TARGET_ELEMENT_TAGS: Dynamic;
  var isInsideSvgDefinitions: Dynamic;
  var countEmptySvgDrawings: Dynamic;
  var isEmptyStructuralTemplate: Dynamic;
  var targetUtf8Encoder: Dynamic;
  var nearestRawTemplateParent: Dynamic;
  var isSuitableTextTarget: Dynamic;
  var containsOnlyTemplateInterpolation: Dynamic;
  var directTargetText: Dynamic;
  function parseTargetTemplate(html?: Dynamic): Dynamic {
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = (0, runtime.toParserHtml)(html);
    return template.content;
  }
  function findEmptyDrawingTarget(
    element?: Dynamic,
    prefix?: Dynamic,
  ): Dynamic {
    if (
      element.localName !== "svg" &&
      (element.textContent ?? "").trim() !== ""
    )
      return null;
    let drawing: Dynamic = element.closest("svg") ?? element;
    if (element.localName !== "svg")
      for (
        let parentElement: Dynamic = drawing.parentElement;
        parentElement !== null &&
        (0, runtime.isDecorativeElement)(parentElement);
        parentElement = parentElement.parentElement
      )
        drawing = parentElement;
    let value: Dynamic = drawing.getAttribute("id") ?? "";
    return (0, runtime.isDecorativeElement)(drawing) && prefix.test(value)
      ? {
          id: value,
          parts: drawing.querySelectorAll("*").length,
        }
      : null;
  }
  function describeTemplateElementTarget(
    element?: Dynamic,
    prefix?: Dynamic,
    loopIndex?: Dynamic,
  ): Dynamic {
    let id: Dynamic = element.getAttribute("id") ?? "",
      directText: Dynamic = directTargetText(element);
    if (/^sc-(?!raw-)/.test(element.localName)) return null;
    let value: Dynamic = new RegExp("^" + prefix + "\\d{1,6}$"),
      value2: Dynamic = findEmptyDrawingTarget(element, value);
    return value.test(id)
      ? {
          id: id,
          tag: element.localName.replace(/^sc-raw-/, ""),
          text: element.textContent ?? "",
          own: directText,
          parent: element.parentElement?.getAttribute("id") ?? "",
          hollow:
            directText === "" &&
            value2 === null &&
            !LEAF_TARGET_ELEMENT_TAGS.has(
              element.localName.replace(/^sc-raw-/, ""),
            ) &&
            (element.children.length > 0 ||
              !value.test(element.parentElement?.getAttribute("id") ?? "")) &&
            !isSuitableTextTarget(element),
          inList: loopIndex >= 0,
          list: loopIndex,
          drawing: value2,
        }
      : null;
  }
  function resolveClickedElementTarget(
    selectorPath?: Dynamic,
    hit2?: Dynamic,
    handles?: Dynamic,
    html?: Dynamic,
    prefix?: Dynamic,
  ): Dynamic {
    let pathTarget: Dynamic =
        hit2 !== null && !hit2.atPath
          ? null
          : (0, runtime.resolveRenderedElementPath)(selectorPath, html, prefix),
      handleTarget: Dynamic =
        hit2 === null || hit2.tid === null
          ? null
          : (0, runtime.resolveTemplateHandleId)(
              hit2.tid,
              handles,
              html,
              prefix,
            ),
      target: Dynamic = pathTarget ?? handleTarget;
    return target === null ||
      (pathTarget !== null &&
        handleTarget !== null &&
        pathTarget.id !== handleTarget.id) ||
      (hit2 !== null &&
        (hit2.tag !== target.tag ||
          (!target.own.includes("{{") && hit2.own !== target.own)))
      ? null
      : target;
  }
  async function resolveFastEditClickTarget(
    webview?: Dynamic,
    html?: Dynamic,
    click?: Dynamic,
    options?: Dynamic,
    prefix?: Dynamic,
  ): Promise<Dynamic> {
    if (
      click.x === undefined ||
      click.y === undefined ||
      !/^[a-z]{1,8}$/.test(prefix)
    )
      return {};
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = options;
    let value: Dynamic = new RegExp("^" + prefix + "\\d{1,6}$"),
      items: Dynamic = [],
      callback: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value10: Dynamic = Array.from(input.children);
        if (
          value10.some(
            (input2?: Dynamic): Dynamic =>
              /^sc-|^(?:dc|x)-import$/.test(input2.localName),
          )
        )
          return;
        let entries: Dynamic = new Map();
        for (let value11 of value10 as Dynamic) {
          let value12: Dynamic = (entries.get(value11.localName) ?? 0) + 1;
          entries.set(value11.localName, value12);
          let value13: Dynamic = value11.getAttribute("id") ?? "";
          if (
            !/^[a-z][a-z0-9-]{0,23}$/.test(value11.localName) ||
            !value.test(value13) ||
            items.length >= 256
          )
            continue;
          let value14: Dynamic =
            options2 +
            " > " +
            value11.localName +
            ":nth-of-type(" +
            String(value12) +
            ")";
          items.push({
            id: value13,
            path: value14,
            parent: context,
          });
          callback(value11, value14, items.length - 1);
        }
      },
      firstElementChild: Dynamic = template.content.firstElementChild;
    if (firstElementChild === null) return {};
    callback(firstElementChild, "#dc-root > div:nth-of-type(1)", -1);
    let value2: Dynamic = items.find(
        (input?: Dynamic): Dynamic =>
          input.parent === -1 &&
          !/ > (?:sc-)?helmet:nth-of-type\(\d+\)$/.test(input.path),
      ),
      value3: Dynamic = Array.from(firstElementChild.children).filter(
        (input?: Dynamic): Dynamic => !/^(?:sc-)?helmet$/.test(input.localName),
      ),
      value4: Dynamic = value3[value3.length - 1]?.getAttribute("id") ?? "",
      value5: Dynamic =
        value2 === undefined
          ? {}
          : {
              first: value2.id,
              ...(value3.length > 1 && value.test(value4)
                ? {
                    lastTop: value4,
                  }
                : {}),
            };
    if (webview.rectsOf === undefined) return value5;
    let value6: Dynamic = await (0, runtime.withFastEditTimeout)(
      webview
        .rectsOf(
          html,
          items.map(
            (input?: Dynamic): Dynamic => ({
              path: input.path,
              tid: null,
            }),
          ),
        )
        .catch((): Dynamic => null),
      2500,
    );
    if (value6 === runtime.FAST_EDIT_TIMEOUT_SENTINEL || value6 === null)
      return value5;
    let x: Dynamic = click.x,
      y3: Dynamic = click.y,
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        input != null &&
        [input.x, input.y, input.w, input.h].every(
          (input2?: Dynamic): Dynamic => Number.isFinite(input2),
        ),
      value7: Dynamic = -1;
    // CucCut: restorer fix — the pointer's x is the outer `x` (click.x), as in the original; the restored code compared the
    // element entry (`input`) with the rect, so no artboard child ever matched the click horizontally.
    items.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
      let value10: Dynamic = value6[options2];
      input.parent === value7 &&
        callback2(value10) &&
        x >= value10.x &&
        x <= value10.x + value10.w &&
        y3 >= value10.y &&
        y3 <= value10.y + value10.h &&
        (value7 = options2);
    });
    if (value7 < 0) return value5;
    let value8: Dynamic, value9: Dynamic;
    items.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
      let value10: Dynamic = value6[options2];
      input.parent !== value7 ||
        !callback2(value10) ||
        (value10.y + value10.h <= y3
          ? (value8 = input.id)
          : value10.x + value10.w <= x && // CucCut: restorer fix — outer `x` (click.x), as above
            y3 >= value10.y &&
            y3 <= value10.y + value10.h &&
            (value9 = input.id));
    });
    return {
      ...value5,
      inside: items[value7].id,
      ...(value9 !== undefined
        ? {
            after: value9,
          }
        : value8 !== undefined
          ? {
              below: value8,
            }
          : {}),
    };
  }
  bindRuntimeValue(
    runtime,
    "STRUCTURAL_LEAF_ELEMENT_TAGS",
    () => STRUCTURAL_LEAF_ELEMENT_TAGS,
    (value) => {
      STRUCTURAL_LEAF_ELEMENT_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pickTargetAppearanceContext",
    () => pickTargetAppearanceContext,
    (value) => {
      pickTargetAppearanceContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pickTargetSiblingContext",
    () => pickTargetSiblingContext,
    (value) => {
      pickTargetSiblingContext = value;
    },
  );
  bindRuntimeValue(runtime, "parseTargetTemplate", () => parseTargetTemplate);
  bindRuntimeValue(
    runtime,
    "readTemplateLoopHtml",
    () => readTemplateLoopHtml,
    (value) => {
      readTemplateLoopHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEAF_TARGET_ELEMENT_TAGS",
    () => LEAF_TARGET_ELEMENT_TAGS,
    (value) => {
      LEAF_TARGET_ELEMENT_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isInsideSvgDefinitions",
    () => isInsideSvgDefinitions,
    (value) => {
      isInsideSvgDefinitions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "countEmptySvgDrawings",
    () => countEmptySvgDrawings,
    (value) => {
      countEmptySvgDrawings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findEmptyDrawingTarget",
    () => findEmptyDrawingTarget,
  );
  bindRuntimeValue(
    runtime,
    "isEmptyStructuralTemplate",
    () => isEmptyStructuralTemplate,
    (value) => {
      isEmptyStructuralTemplate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "targetUtf8Encoder",
    () => targetUtf8Encoder,
    (value) => {
      targetUtf8Encoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nearestRawTemplateParent",
    () => nearestRawTemplateParent,
    (value) => {
      nearestRawTemplateParent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSuitableTextTarget",
    () => isSuitableTextTarget,
    (value) => {
      isSuitableTextTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "containsOnlyTemplateInterpolation",
    () => containsOnlyTemplateInterpolation,
    (value) => {
      containsOnlyTemplateInterpolation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "directTargetText",
    () => directTargetText,
    (value) => {
      directTargetText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeTemplateElementTarget",
    () => describeTemplateElementTarget,
  );
  bindRuntimeValue(
    runtime,
    "resolveClickedElementTarget",
    () => resolveClickedElementTarget,
  );
  bindRuntimeValue(
    runtime,
    "resolveFastEditClickTarget",
    () => resolveFastEditClickTarget,
  );
  return () => {
    STRUCTURAL_LEAF_ELEMENT_TAGS = new Set([
      "img",
      "svg",
      "g",
      "path",
      "circle",
      "ellipse",
      "rect",
      "line",
      "polyline",
      "polygon",
      "text",
      "tspan",
      "button",
      "input",
      "textarea",
      "select",
      "video",
      "canvas",
    ]);
    pickTargetAppearanceContext = (input?: Dynamic): Dynamic => ({
      ...(input.ground !== undefined
        ? {
            ground: input.ground,
          }
        : {}),
      ...(input.behind !== undefined
        ? {
            behind: input.behind,
          }
        : {}),
      ...(input.w !== undefined && input.h !== undefined
        ? {
            w: input.w,
            h: input.h,
          }
        : {}),
    });
    pickTargetSiblingContext = (input?: Dynamic): Dynamic =>
      input.first === undefined
        ? {}
        : {
            first: input.first,
            ...(input.lastTop !== undefined
              ? {
                  lastTop: input.lastTop,
                }
              : {}),
          };
    readTemplateLoopHtml = (input?: Dynamic, options?: Dynamic): Dynamic =>
      parseTargetTemplate(input).querySelectorAll("sc-for")[options]
        ?.outerHTML ?? "";
    LEAF_TARGET_ELEMENT_TAGS = new Set([
      ...STRUCTURAL_LEAF_ELEMENT_TAGS,
      "picture",
      "br",
      "hr",
      "dc-import",
      "x-import",
    ]);
    isInsideSvgDefinitions = (input?: Dynamic, options?: Dynamic): Dynamic => {
      for (
        let parentElement: Dynamic = input.parentElement;
        parentElement !== null && parentElement !== options;
        parentElement = parentElement.parentElement
      )
        if (
          /^(?:defs|symbol|clippath|mask|pattern)$/i.test(
            parentElement.localName,
          )
        )
          return true;
      return false;
    };
    countEmptySvgDrawings = (input?: Dynamic): Dynamic =>
      /<svg\b/i.test(input)
        ? Array.from(parseTargetTemplate(input).querySelectorAll("svg")).filter(
            (input2?: Dynamic): Dynamic =>
              !Array.from(
                input2.querySelectorAll(
                  "path, circle, ellipse, rect, line, polyline, polygon, use, text",
                ),
              ).some(
                (input3?: Dynamic): Dynamic =>
                  (input3.localName !== "text" ||
                    (input3.textContent ?? "").trim() !== "") &&
                  !isInsideSvgDefinitions(input3, input2),
              ),
          ).length
        : 0;
    isEmptyStructuralTemplate = (input?: Dynamic): Dynamic => {
      let firstElementChild: Dynamic =
        parseTargetTemplate(input).firstElementChild;
      return (
        firstElementChild !== null &&
        (firstElementChild.textContent ?? "").trim() === "" &&
        Array.from(firstElementChild.children).every(
          (input2?: Dynamic): Dynamic =>
            input2.children.length === 0 &&
            !STRUCTURAL_LEAF_ELEMENT_TAGS.has(input2.localName) &&
            !input2.localName.includes("-"),
        )
      );
    };
    targetUtf8Encoder = new TextEncoder();
    nearestRawTemplateParent = (input?: Dynamic): Dynamic => {
      let parentElement: Dynamic = input.parentElement;
      for (
        ;
        parentElement !== null && /^sc-(?!raw-)/.test(parentElement.localName);

      )
        parentElement = parentElement.parentElement;
      return parentElement;
    };
    isSuitableTextTarget = (input?: Dynamic): Dynamic =>
      (nearestRawTemplateParent(input)?.parentElement ?? null) !== null &&
      (0, runtime.extractVisibleElementText)(input, {
        enough: 1 / 0,
      }).trim() !== "" &&
      targetUtf8Encoder.encode(
        (0, runtime.truncateLargeDataUris)(input.outerHTML),
      ).length <= 12e3;
    containsOnlyTemplateInterpolation = (input?: Dynamic): Dynamic =>
      input.includes("{{") &&
      input.replace(/\{\{[\s\S]*?\}\}/g, "").trim() === "";
    directTargetText = (input?: Dynamic): Dynamic =>
      Array.from(input.childNodes)
        .filter((input2?: Dynamic): Dynamic => input2.nodeType === 3)
        .map((input2?: Dynamic): Dynamic => input2.textContent ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
  };
}
