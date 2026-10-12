/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** How an element's `white-space` collapses the whitespace of its text. */
export type SearchWhitespaceMode = "keep-newlines" | "all" | "none";
/** A stretch of visible text without block boundaries, with a map back to the DOM text nodes. */
export interface SearchTextRun {
  text: string;
  nodes: Text[];
  /** For each character of `text`, the index of its text node in `nodes`. */
  nodeAt: number[];
  /** For each character of `text`, its offset inside that text node. */
  offsetAt: number[];
  /** True when whitespace of the run was collapsed. */
  collapses: boolean;
}
export interface DomTextSearchOptions {
  /** Stops after this many ranges. */
  limit?: number;
  /** Elements for which this returns true are not searched. */
  skip?: (element: Element) => boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SPECIAL_SEARCH_LOWERCASE_PATTERN: RegExp;
    SEARCH_SPACE_AND_SIGMA_PATTERN: RegExp;
    normalizeSearchCharacter: (character: string) => string;
    normalizeSearchText: (text: string) => string;
    findTextOffsets: (text: string, query: string) => number[];
    SEARCH_BLOCK_TAGS: Set<string>;
    SEARCH_SKIPPED_TAGS: Set<string>;
    MAX_SEARCH_DOM_NODES: number;
    MAX_SEARCH_CHARACTERS: number;
    SEARCH_COLLAPSIBLE_WHITESPACE: RegExp;
    collapseSearchWhitespace: (text: string) => string;
    searchWhitespaceMode: (
      whiteSpace: string,
      element: Element,
    ) => SearchWhitespaceMode;
    isSearchBlockElement: (element: Element, display: string) => boolean;
    isInvisibleSearchAncestor: (element: Element) => boolean;
    isVisibleSearchElement: (
      element: Element,
      style?: CSSStyleDeclaration | null,
    ) => boolean;
    visitSearchTextRuns: (
      container: Element,
      skip: DomTextSearchOptions["skip"],
      onRun: (run: SearchTextRun) => boolean,
    ) => void;
    findDomTextRanges: (
      container: Element,
      query: string,
      options?: DomTextSearchOptions,
    ) => AbstractRange[];
    liveRangeFromStaticRange: (staticRange: AbstractRange) => Range | null;
    findRangeRectangle: (range: AbstractRange) => DOMRect | null;
  }
}

export function installEditorDomTextSearch(
  runtime: RuntimeBindings,
): () => void {
  var SPECIAL_SEARCH_LOWERCASE_PATTERN: RuntimeBindings["SPECIAL_SEARCH_LOWERCASE_PATTERN"];
  var SEARCH_SPACE_AND_SIGMA_PATTERN: RuntimeBindings["SEARCH_SPACE_AND_SIGMA_PATTERN"];
  var normalizeSearchCharacter: RuntimeBindings["normalizeSearchCharacter"];
  var SEARCH_BLOCK_TAGS: RuntimeBindings["SEARCH_BLOCK_TAGS"];
  var SEARCH_SKIPPED_TAGS: RuntimeBindings["SEARCH_SKIPPED_TAGS"];
  var MAX_SEARCH_DOM_NODES: RuntimeBindings["MAX_SEARCH_DOM_NODES"];
  var MAX_SEARCH_CHARACTERS: RuntimeBindings["MAX_SEARCH_CHARACTERS"];
  var SEARCH_COLLAPSIBLE_WHITESPACE: RuntimeBindings["SEARCH_COLLAPSIBLE_WHITESPACE"];
  function normalizeSearchText(text: string): string {
    let value = text.toLowerCase();
    if (
      value.length === text.length &&
      !SPECIAL_SEARCH_LOWERCASE_PATTERN.test(text)
    ) {
      return value.replace(
        SEARCH_SPACE_AND_SIGMA_PATTERN,
        normalizeSearchCharacter,
      );
    }
    let text2 = "";
    for (let index = 0; index < text.length; index++) {
      let value2 = text[index]!.toLowerCase();
      text2 += value2.length === 1 ? value2 : text[index];
    }
    return text2.replace(
      SEARCH_SPACE_AND_SIGMA_PATTERN,
      normalizeSearchCharacter,
    );
  }
  function findTextOffsets(text: string, query: string): number[] {
    if (query === "") {
      return [];
    }
    let value = normalizeSearchText(text),
      value2 = normalizeSearchText(query),
      items: number[] = [];
    for (
      let value3 = value.indexOf(value2);
      value3 !== -1;
      value3 = value.indexOf(value2, value3 + value2.length)
    )
      items.push(value3);
    return items;
  }
  function collapseSearchWhitespace(text: string): string {
    return text.replace(SEARCH_COLLAPSIBLE_WHITESPACE, " ");
  }
  function searchWhitespaceMode(
    whiteSpace: string,
    element: Element,
  ): SearchWhitespaceMode {
    if (whiteSpace === "pre-line") {
      return "keep-newlines";
    }
    if (whiteSpace === "normal" || whiteSpace === "nowrap") {
      return "all";
    }
    if (whiteSpace === "") {
      if (element.closest("pre, textarea") === null) {
        return "all";
      } else {
        return "none";
      }
    }
    return "none";
  }
  function isSearchBlockElement(element: Element, display: string): boolean {
    if (element.tagName === "BR") {
      return true;
    }
    if (display === "") {
      return SEARCH_BLOCK_TAGS.has(element.tagName);
    }
    return (
      display !== "inline" &&
      display !== "contents" &&
      display !== "inline-block" &&
      display !== "inline-flex"
    );
  }
  function isInvisibleSearchAncestor(element: Element): boolean {
    let defaultView = element.ownerDocument.defaultView,
      flag = false;
    for (
      let value: Element | null = element;
      value !== null;
      value = value.parentElement
    ) {
      if (
        parseFloat(defaultView?.getComputedStyle(value).opacity ?? "") !== 0
      ) {
        continue;
      }
      if (
        !(value.getAnimations?.() ?? []).some(
          (input: Animation): boolean =>
            input.playState === "running" &&
            (input.effect as KeyframeEffect | null)
              ?.getKeyframes?.()
              .some(
                (input2: ComputedKeyframe): boolean => "opacity" in input2,
              ) === true,
        )
      ) {
        return false;
      }
      flag = true;
    }
    return flag;
  }
  function isVisibleSearchElement(
    element: Element,
    style?: CSSStyleDeclaration | null,
  ): boolean {
    let value = style?.visibility ?? "";
    if (value !== "" && value !== "visible") {
      return false;
    }
    let value2: Element | null = element;
    while (
      value2 !== null &&
      (value2 === element
        ? style?.display
        : value2.ownerDocument.defaultView?.getComputedStyle(value2)
            .display) === "contents"
    )
      value2 = value2.parentElement;
    let value3 = value2?.checkVisibility;
    if (
      value2 === null ||
      typeof value3 !== "function" ||
      value3.call(value2, {
        opacityProperty: true,
        checkOpacity: true,
      })
    ) {
      return true;
    }
    return value3.call(value2, {}) && isInvisibleSearchAncestor(value2);
  }
  function visitSearchTextRuns(
    container: Element,
    skip: DomTextSearchOptions["skip"],
    onRun: (run: SearchTextRun) => boolean,
  ): void {
    let defaultView = container.ownerDocument.defaultView,
      items: string[] = [],
      state: SearchTextRun = {
        text: "",
        nodes: [],
        nodeAt: [],
        offsetAt: [],
        collapses: false,
      },
      text = "",
      index = 0,
      value = MAX_SEARCH_CHARACTERS,
      flag = true,
      callback = (): void => {
        if (state.collapses && text === " ") {
          items.pop();
          state.nodeAt.pop();
          state.offsetAt.pop();
        }
        if (items.length > 0 && flag) {
          state.text = items.join("");
          flag = onRun(state);
        }
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
      callback2 = (input: Text, options: SearchWhitespaceMode): void => {
        let data = input.data,
          value2 = state.nodes.push(input) - 1;
        if (options !== "none") {
          state.collapses = true;
        }
        for (
          let index2 = 0;
          index2 < data.length && value > 0;
          index2++, value--
        ) {
          let value3 = data[index2]!;
          if (
            options !== "none" &&
            (value3 === " " ||
              value3 === "\t" ||
              value3 === "\r" ||
              value3 === "\f" ||
              value3 === " " ||
              value3 === " " ||
              value3 === " " ||
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
            ) {
              continue;
            }
            value3 = " ";
          }
          items.push(value3);
          state.nodeAt.push(value2);
          state.offsetAt.push(index2);
          text = value3;
        }
      },
      callback3 = (input: Element): void => {
        if (
          !flag ||
          SEARCH_SKIPPED_TAGS.has(input.tagName.toUpperCase()) ||
          skip?.(input) === true
        ) {
          return;
        }
        let value2 = defaultView?.getComputedStyle(input),
          value3 = value2?.display ?? "";
        if (value3 === "none") {
          return;
        }
        let value4 = input !== container && isSearchBlockElement(input, value3);
        if (value4) {
          callback();
        }
        let value5: boolean | undefined,
          text2: SearchWhitespaceMode = "none";
        for (
          let firstChild: ChildNode | null = input.firstChild;
          firstChild !== null && flag;
          firstChild = firstChild.nextSibling
        ) {
          if (++index > MAX_SEARCH_DOM_NODES) {
            flag = false;
            return;
          }
          if (firstChild.nodeType === 3) {
            if (value5 === undefined) {
              value5 = isVisibleSearchElement(input, value2);
              text2 = value5
                ? searchWhitespaceMode(value2?.whiteSpace ?? "", input)
                : "none";
            }
            if (value5) {
              callback2(firstChild as Text, text2);
            }
          } else if (firstChild.nodeType === 1) {
            callback3(firstChild as Element);
          }
        }
        if (value4) {
          callback();
        }
      };
    callback3(container);
    callback();
  }
  function findDomTextRanges(
    container: Element,
    query: string,
    options: DomTextSearchOptions = {},
  ): AbstractRange[] {
    let items: AbstractRange[] = [],
      value = options.limit ?? 1 / 0,
      value2 = container.ownerDocument.defaultView?.StaticRange,
      value3 = collapseSearchWhitespace(query);
    visitSearchTextRuns(container, options.skip, (input: SearchTextRun): boolean => {
      let value4 = input.collapses ? value3 : query;
      for (let value5 of findTextOffsets(input.text, value4)) {
        if (items.length >= value) {
          return false;
        }
        let value6 = value5 + value4.length - 1,
          state = {
            node: input.nodes[input.nodeAt[value5]!]!,
            offset: input.offsetAt[value5]!,
          },
          state2 = {
            node: input.nodes[input.nodeAt[value6]!]!,
            offset: input.offsetAt[value6]! + 1,
          };
        if (typeof value2 === "function") {
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
        let value7 = container.ownerDocument.createRange();
        value7.setStart(state.node, state.offset);
        value7.setEnd(state2.node, state2.offset);
        items.push(value7);
      }
      return true;
    });
    return items;
  }
  function liveRangeFromStaticRange(staticRange: AbstractRange): Range | null {
    let ownerDocument = staticRange.startContainer.ownerDocument;
    if (
      !ownerDocument ||
      !staticRange.startContainer.isConnected ||
      !staticRange.endContainer.isConnected
    ) {
      return null;
    }
    let value = ownerDocument.createRange();
    value.setStart(staticRange.startContainer, staticRange.startOffset);
    value.setEnd(staticRange.endContainer, staticRange.endOffset);
    return value;
  }
  function findRangeRectangle(range: AbstractRange): DOMRect | null {
    try {
      return liveRangeFromStaticRange(range)?.getBoundingClientRect() ?? null;
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "SPECIAL_SEARCH_LOWERCASE_PATTERN",
    () => SPECIAL_SEARCH_LOWERCASE_PATTERN,
    (value) => {
      SPECIAL_SEARCH_LOWERCASE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SEARCH_SPACE_AND_SIGMA_PATTERN",
    () => SEARCH_SPACE_AND_SIGMA_PATTERN,
    (value) => {
      SEARCH_SPACE_AND_SIGMA_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeSearchCharacter",
    () => normalizeSearchCharacter,
    (value) => {
      normalizeSearchCharacter = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeSearchText", () => normalizeSearchText);
  bindRuntimeValue(runtime, "findTextOffsets", () => findTextOffsets);
  bindRuntimeValue(
    runtime,
    "SEARCH_BLOCK_TAGS",
    () => SEARCH_BLOCK_TAGS,
    (value) => {
      SEARCH_BLOCK_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SEARCH_SKIPPED_TAGS",
    () => SEARCH_SKIPPED_TAGS,
    (value) => {
      SEARCH_SKIPPED_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SEARCH_DOM_NODES",
    () => MAX_SEARCH_DOM_NODES,
    (value) => {
      MAX_SEARCH_DOM_NODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SEARCH_CHARACTERS",
    () => MAX_SEARCH_CHARACTERS,
    (value) => {
      MAX_SEARCH_CHARACTERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SEARCH_COLLAPSIBLE_WHITESPACE",
    () => SEARCH_COLLAPSIBLE_WHITESPACE,
    (value) => {
      SEARCH_COLLAPSIBLE_WHITESPACE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collapseSearchWhitespace",
    () => collapseSearchWhitespace,
  );
  bindRuntimeValue(runtime, "searchWhitespaceMode", () => searchWhitespaceMode);
  bindRuntimeValue(runtime, "isSearchBlockElement", () => isSearchBlockElement);
  bindRuntimeValue(
    runtime,
    "isInvisibleSearchAncestor",
    () => isInvisibleSearchAncestor,
  );
  bindRuntimeValue(
    runtime,
    "isVisibleSearchElement",
    () => isVisibleSearchElement,
  );
  bindRuntimeValue(runtime, "visitSearchTextRuns", () => visitSearchTextRuns);
  bindRuntimeValue(runtime, "findDomTextRanges", () => findDomTextRanges);
  bindRuntimeValue(
    runtime,
    "liveRangeFromStaticRange",
    () => liveRangeFromStaticRange,
  );
  bindRuntimeValue(runtime, "findRangeRectangle", () => findRangeRectangle);
  return () => {
    SPECIAL_SEARCH_LOWERCASE_PATTERN = /[\u03a3\ud800-\udfff]/;
    SEARCH_SPACE_AND_SIGMA_PATTERN = /[\u00a0\u2007\u202f\u03c2]/g;
    normalizeSearchCharacter = (character: string): string =>
      character === "ς" ? "σ" : " ";
    SEARCH_BLOCK_TAGS = new Set([
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
    SEARCH_SKIPPED_TAGS = new Set([
      "SCRIPT",
      "STYLE",
      "TEMPLATE",
      "NOSCRIPT",
      "TEXTAREA",
      "IFRAME",
    ]);
    MAX_SEARCH_DOM_NODES = 200000;
    MAX_SEARCH_CHARACTERS = 2000000;
    SEARCH_COLLAPSIBLE_WHITESPACE = /[ \t\n\r\f\u00a0\u2007\u202f]+/g;
  };
}
