/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFindTextRanges(runtime: RuntimeBindings): () => void {
  var caseFoldSlowPathPattern: Dynamic;
  var caseFoldReplacementPattern: Dynamic;
  var replaceCaseFoldCharacter: Dynamic;
  var findBlockBoundaryTags: Dynamic;
  var findExcludedTags: Dynamic;
  var findMaxTextRunLength: Dynamic;
  var findMaxVisitedNodes: Dynamic;
  var findCollapsibleWhitespacePattern: Dynamic;
  function foldFindText(text?: Dynamic): Dynamic {
    let value: Dynamic = text.toLowerCase();
    if (value.length === text.length && !caseFoldSlowPathPattern.test(text))
      return value.replace(
        caseFoldReplacementPattern,
        replaceCaseFoldCharacter,
      );
    let text2: Dynamic = "";
    for (let index: Dynamic = 0; index < text.length; index++) {
      let value2: Dynamic = text[index].toLowerCase();
      text2 += value2.length === 1 ? value2 : text[index];
    }
    return text2.replace(caseFoldReplacementPattern, replaceCaseFoldCharacter);
  }
  function findTextOffsets(text?: Dynamic, query?: Dynamic): Dynamic {
    if (query === "") return [];
    let value: Dynamic = foldFindText(text),
      value2: Dynamic = foldFindText(query),
      items: Dynamic = [];
    for (
      let value3: Dynamic = value.indexOf(value2);
      value3 !== -1;
      value3 = value.indexOf(value2, value3 + value2.length)
    )
      items.push(value3);
    return items;
  }
  function collapseFindWhitespace(text?: Dynamic): Dynamic {
    return text.replace(findCollapsibleWhitespacePattern, " ");
  }
  function findWhitespaceCollapseMode(
    whiteSpace?: Dynamic,
    element?: Dynamic,
  ): Dynamic {
    return whiteSpace === "pre-line"
      ? "keep-newlines"
      : whiteSpace === "normal" ||
          whiteSpace === "nowrap" ||
          (whiteSpace === "" && element.closest("pre, textarea") === null)
        ? "all"
        : "none";
  }
  function isFindBlockBoundary(element?: Dynamic, display?: Dynamic): Dynamic {
    return element.tagName === "BR"
      ? true
      : display === ""
        ? findBlockBoundaryTags.has(element.tagName)
        : display !== "inline" &&
          display !== "contents" &&
          display !== "inline-block" &&
          display !== "inline-flex";
  }
  function isElementPermanentlyTransparent(element?: Dynamic): Dynamic {
    let defaultView: Dynamic = element.ownerDocument.defaultView,
      flag: Dynamic = false;
    for (
      let value: Dynamic = element;
      value !== null;
      value = value.parentElement
    ) {
      if (parseFloat(defaultView?.getComputedStyle(value).opacity ?? "") !== 0)
        continue;
      if (
        !(value.getAnimations?.() ?? []).some(
          (input?: Dynamic): Dynamic =>
            input.playState === "running" &&
            input.effect
              ?.getKeyframes?.()
              .some((input2?: Dynamic): Dynamic => "opacity" in input2) ===
              true,
        )
      )
        return false;
      flag = true;
    }
    return flag;
  }
  function isFindElementVisible(element?: Dynamic, style?: Dynamic): Dynamic {
    let value: Dynamic = style?.visibility ?? "";
    if (value !== "" && value !== "visible") return false;
    let value2: Dynamic = element;
    for (
      ;
      value2 !== null &&
      (value2 === element
        ? style?.display
        : value2.ownerDocument.defaultView?.getComputedStyle(value2)
            .display) === "contents";

    )
      value2 = value2.parentElement;
    let value3: Dynamic = value2?.checkVisibility;
    return value2 === null ||
      typeof value3 != "function" ||
      value3.call(value2, {
        opacityProperty: true,
        checkOpacity: true,
      })
      ? true
      : value3.call(value2, {}) && isElementPermanentlyTransparent(value2);
  }
  function visitRenderedTextRuns(
    element?: Dynamic,
    skip?: Dynamic,
    visit?: Dynamic,
  ): Dynamic {
    let defaultView: Dynamic = element.ownerDocument.defaultView,
      items: Dynamic = [],
      state: Dynamic = {
        text: "",
        nodes: [],
        nodeAt: [],
        offsetAt: [],
        collapses: false,
      },
      text: Dynamic = "",
      index: Dynamic = 0,
      value: Dynamic = findMaxVisitedNodes,
      flag: Dynamic = true,
      callback: Dynamic = (): Dynamic => {
        state.collapses &&
          text === " " &&
          (items.pop(), state.nodeAt.pop(), state.offsetAt.pop());
        items.length > 0 &&
          flag &&
          ((state.text = items.join("")), (flag = visit(state)));
        items = [];
        state = {
          text: "",
          nodes: [],
          nodeAt: [],
          offsetAt: [],
          collapses: false,
        };
        text = "";
      },
      callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let data: Dynamic = input.data,
          value2: Dynamic = state.nodes.push(input) - 1;
        options !== "none" && (state.collapses = true);
        for (
          let index2: Dynamic = 0;
          index2 < data.length && value > 0;
          index2++, value--
        ) {
          let value3: Dynamic = data[index2];
          if (
            options !== "none" &&
            (value3 === " " ||
              value3 === "	" ||
              value3 === "\r" ||
              value3 === "\f" ||
              value3 === "\xA0" ||
              value3 === "\u2007" ||
              value3 === "\u202F" ||
              (value3 ===
                `
` &&
                options === "all"))
          ) {
            if (
              text === "" ||
              text === " " ||
              text ===
                `
`
            )
              continue;
            value3 = " ";
          }
          items.push(value3);
          state.nodeAt.push(value2);
          state.offsetAt.push(index2);
          text = value3;
        }
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        if (
          !flag ||
          findExcludedTags.has(input.tagName.toUpperCase()) ||
          skip?.(input) === true
        )
          return;
        let value2: Dynamic = defaultView?.getComputedStyle(input),
          value3: Dynamic = value2?.display ?? "";
        if (value3 === "none") return;
        let value4: Dynamic =
          input !== element && isFindBlockBoundary(input, value3);
        value4 && callback();
        let value5: Dynamic,
          text2: Dynamic = "none";
        for (
          let firstChild: Dynamic = input.firstChild;
          firstChild !== null && flag;
          firstChild = firstChild.nextSibling
        ) {
          if (++index > findMaxTextRunLength) {
            flag = false;
            return;
          }
          firstChild.nodeType === 3
            ? (value5 === undefined &&
                ((value5 = isFindElementVisible(input, value2)),
                (text2 = value5
                  ? findWhitespaceCollapseMode(value2?.whiteSpace ?? "", input)
                  : "none")),
              value5 && callback2(firstChild, text2))
            : firstChild.nodeType === 1 && callback3(firstChild);
        }
        value4 && callback();
      };
    callback3(element);
    callback();
  }
  function findRenderedTextRanges(
    element?: Dynamic,
    query?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let items: Dynamic = [],
      value: Dynamic = options.limit ?? 1 / 0,
      value2: Dynamic = element.ownerDocument.defaultView?.StaticRange,
      value3: Dynamic = collapseFindWhitespace(query);
    visitRenderedTextRuns(element, options.skip, (input?: Dynamic): Dynamic => {
      let value4: Dynamic = input.collapses ? value3 : query;
      for (let value5 of findTextOffsets(input.text, value4) as Dynamic) {
        if (items.length >= value) return false;
        let value6: Dynamic = value5 + value4.length - 1,
          state: Dynamic = {
            node: input.nodes[input.nodeAt[value5]],
            offset: input.offsetAt[value5],
          },
          state2: Dynamic = {
            node: input.nodes[input.nodeAt[value6]],
            offset: input.offsetAt[value6] + 1,
          };
        if (typeof value2 == "function") {
          items.push(
            new value2({
              startContainer: state.node,
              startOffset: state.offset,
              endContainer: state2.node,
              endOffset: state2.offset,
            }),
          );
          continue;
        }
        let value7: Dynamic = element.ownerDocument.createRange();
        value7.setStart(state.node, state.offset);
        value7.setEnd(state2.node, state2.offset);
        items.push(value7);
      }
      return true;
    });
    return items;
  }
  function liveRangeFromStaticRange(range?: Dynamic): Dynamic {
    let ownerDocument: Dynamic = range.startContainer.ownerDocument;
    if (
      !ownerDocument ||
      !range.startContainer.isConnected ||
      !range.endContainer.isConnected
    )
      return null;
    let value: Dynamic = ownerDocument.createRange();
    value.setStart(range.startContainer, range.startOffset);
    value.setEnd(range.endContainer, range.endOffset);
    return value;
  }
  function safeRangeClientRect(range?: Dynamic): Dynamic {
    try {
      return liveRangeFromStaticRange(range)?.getBoundingClientRect() ?? null;
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "caseFoldSlowPathPattern",
    () => caseFoldSlowPathPattern,
    (value) => {
      caseFoldSlowPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "caseFoldReplacementPattern",
    () => caseFoldReplacementPattern,
    (value) => {
      caseFoldReplacementPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "replaceCaseFoldCharacter",
    () => replaceCaseFoldCharacter,
    (value) => {
      replaceCaseFoldCharacter = value;
    },
  );
  bindRuntimeValue(runtime, "foldFindText", () => foldFindText);
  bindRuntimeValue(runtime, "findTextOffsets", () => findTextOffsets);
  bindRuntimeValue(
    runtime,
    "findBlockBoundaryTags",
    () => findBlockBoundaryTags,
    (value) => {
      findBlockBoundaryTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findExcludedTags",
    () => findExcludedTags,
    (value) => {
      findExcludedTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findMaxTextRunLength",
    () => findMaxTextRunLength,
    (value) => {
      findMaxTextRunLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findMaxVisitedNodes",
    () => findMaxVisitedNodes,
    (value) => {
      findMaxVisitedNodes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findCollapsibleWhitespacePattern",
    () => findCollapsibleWhitespacePattern,
    (value) => {
      findCollapsibleWhitespacePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collapseFindWhitespace",
    () => collapseFindWhitespace,
  );
  bindRuntimeValue(
    runtime,
    "findWhitespaceCollapseMode",
    () => findWhitespaceCollapseMode,
  );
  bindRuntimeValue(runtime, "isFindBlockBoundary", () => isFindBlockBoundary);
  bindRuntimeValue(
    runtime,
    "isElementPermanentlyTransparent",
    () => isElementPermanentlyTransparent,
  );
  bindRuntimeValue(runtime, "isFindElementVisible", () => isFindElementVisible);
  bindRuntimeValue(
    runtime,
    "visitRenderedTextRuns",
    () => visitRenderedTextRuns,
  );
  bindRuntimeValue(
    runtime,
    "findRenderedTextRanges",
    () => findRenderedTextRanges,
  );
  bindRuntimeValue(
    runtime,
    "liveRangeFromStaticRange",
    () => liveRangeFromStaticRange,
  );
  bindRuntimeValue(runtime, "safeRangeClientRect", () => safeRangeClientRect);
  return () => {
    caseFoldSlowPathPattern = /[\u03a3\ud800-\udfff]/;
    caseFoldReplacementPattern = /[\u00a0\u2007\u202f\u03c2]/g;
    replaceCaseFoldCharacter = (input?: Dynamic): Dynamic =>
      input === "\u03C2" ? "\u03C3" : " ";
    findBlockBoundaryTags = new Set([
      "ADDRESS",
      "ARTICLE",
      "ASIDE",
      "BLOCKQUOTE",
      "DD",
      "DIV",
      "DL",
      "DT",
      "FIGCAPTION",
      "FIGURE",
      "FOOTER",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "HEADER",
      "HR",
      "LI",
      "MAIN",
      "NAV",
      "OL",
      "P",
      "PRE",
      "SECTION",
      "TABLE",
      "TBODY",
      "TD",
      "TFOOT",
      "TH",
      "THEAD",
      "TR",
      "UL",
    ]);
    findExcludedTags = new Set([
      "SCRIPT",
      "STYLE",
      "TEMPLATE",
      "NOSCRIPT",
      "TEXTAREA",
      "IFRAME",
    ]);
    findMaxTextRunLength = 2e5;
    findMaxVisitedNodes = 2e6;
    findCollapsibleWhitespacePattern = /[ \t\n\r\f\u00a0\u2007\u202f]+/g;
  };
}
