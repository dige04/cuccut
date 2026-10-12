/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { TextMark, TextNode } from "../deck-contracts";

/** Inline formatting a text run or mark can carry (a mark without its range). */
export type InlineFormat = Omit<TextMark, "start" | "end">;
/** A contiguous piece of text with uniform inline formatting. */
export interface TextRun extends InlineFormat {
  text: string;
}
/** List style of a text node: bulleted or numbered. */
export type TextListKind = NonNullable<TextNode["list"]>;
/** Text, marks and list style as read back from an editable element. */
export interface EditableRichText {
  text: string;
  marks: TextMark[] | undefined;
  list: TextListKind | undefined;
}
/** Formatting that applies to the whole current selection of an editable element. */
export interface RichTextSelectionFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color?: string;
  href?: string;
  /** The selection touches a link. */
  touchesLink?: true;
  list?: TextListKind;
}
/** Formatting in effect at one node, including whether it sits inside a link. */
interface NodeFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  inLink?: boolean;
  color?: string;
  href?: string;
  list?: TextListKind;
}
/** The anchors touched by a selection, and a range spanning exactly them. */
export interface SelectionAnchors {
  range: Range;
  anchors: Element[];
}
/** Bookkeeping that lets one native undo/redo replay a list auto-conversion. */
export interface RichTextUndoState {
  intermediate: string;
  undoArmed: boolean;
  redoArmed: boolean;
}
/** An input event: the fields of `InputEvent` the history reconciler reads. */
export type RichTextInputEvent = Event & {
  inputType?: string;
  data?: string | null;
};
/** The source of text runs: a text node's text and marks. */
export type TextRunSource = Pick<TextNode, "text" | "marks">;
type TextRunsForRange = (
  text: string,
  marks: TextMark[],
  start: number,
  end: number,
) => TextRun[];
type TextLinesAsRuns = (node: TextRunSource) => TextRun[][];
type ReadEditableRichText = (element: Node) => EditableRichText;
type ReadRichTextSelection = (
  element: Element,
  node?: (color: string) => string | undefined,
) => RichTextSelectionFormat | null;
type SelectionAnchorElements = (
  element: Element,
  range: Range,
) => SelectionAnchors | null;
type UnwrapAnchorElements = (anchors: Node[]) => void;
type ClearRichTextUndoState = (element: Element) => void;
type RichTextDomFingerprint = (element: Node) => string;
type ReconcileNativeRichTextHistory = (
  element: Element,
  event: RichTextInputEvent,
) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    richTextUndoStates: WeakMap<Element, RichTextUndoState>;
    replayingRichTextHistory: boolean;
    initializeRichTextDom: () => void;
    textRunsForRange: TextRunsForRange;
    textLinesAsRuns: TextLinesAsRuns;
    readEditableRichText: ReadEditableRichText;
    readRichTextSelection: ReadRichTextSelection;
    selectionAnchorElements: SelectionAnchorElements;
    unwrapAnchorElements: UnwrapAnchorElements;
    clearRichTextUndoState: ClearRichTextUndoState;
    richTextDomFingerprint: RichTextDomFingerprint;
    reconcileNativeRichTextHistory: ReconcileNativeRichTextHistory;
  }
}

export function installModelRichTextDom(runtime: RuntimeBindings): () => void {
  var richTextUndoStates: WeakMap<Element, RichTextUndoState>;
  var replayingRichTextHistory: boolean;
  var initializeRichTextDom: () => void;
  function textRunsForRange(
    text: string,
    marks: TextMark[],
    start: number,
    end: number,
  ): TextRun[] {
    let items: TextRun[] = [],
      value = start;
    for (let value2 of marks) {
      if (value2.end <= start) {
        continue;
      }
      if (value2.start >= end) {
        break;
      }
      let value3 = Math.max(value2.start, start),
        value4 = Math.min(value2.end, end);
      if (value3 > value) {
        items.push({
          text: text.slice(value, value3),
        });
      }
      let state: TextRun = {
        text: text.slice(value3, value4),
      };
      if (value2.bold) {
        state.bold = true;
      }
      if (value2.italic) {
        state.italic = true;
      }
      if (value2.underline) {
        state.underline = true;
      }
      if (value2.color !== undefined) {
        state.color = value2.color;
      }
      if (value2.href !== undefined) {
        state.href = value2.href;
      }
      items.push(state);
      value = value4;
    }
    if (value < end) {
      items.push({
        text: text.slice(value, end),
      });
    }
    return items.filter((input) => input.text !== "");
  }
  function textLinesAsRuns(node: TextRunSource): TextRun[][] {
    let marks = node.marks ?? [],
      lines: TextRun[][] = [],
      lineStart = 0,
      text = node.text;
    for (let index = 0; index <= text.length; index++)
      if (
        index === text.length ||
        text[index] ===
          `
`
      ) {
        lines.push(textRunsForRange(text, marks, lineStart, index));
        lineStart = index + 1;
      }
    return lines;
  }
  function readEditableRichText(element: Node): EditableRichText {
    let text = "",
      marks: TextMark[] = [],
      list: TextListKind | undefined,
      appendText = (input: string, options: InlineFormat): void => {
        if (input === "") {
          return;
        }
        let length = text.length;
        text += input;
        if (
          options.bold !== undefined ||
          options.italic !== undefined ||
          options.underline !== undefined ||
          options.color !== undefined ||
          options.href !== undefined
        ) {
          marks.push({
            start: length,
            end: text.length,
            ...options,
          });
        }
      },
      callback = (): void => {
        if (
          text !== "" &&
          !text.endsWith(`
`)
        ) {
          text += `
`;
        }
      },
      callback2 = (input: Node, options: InlineFormat): void => {
        if (input.nodeType === 3) {
          appendText(input.nodeValue ?? "", options);
          return;
        }
        if (input.nodeType !== 1) {
          return;
        }
        let value2 = input as Element,
          tagName = value2.tagName;
        if (tagName === "BR") {
          text += `
`;
          return;
        }
        let value3 = options,
          flag = false;
        if (tagName === "B" || tagName === "STRONG") {
          value3 = {
            ...options,
            bold: true,
          };
        } else if (tagName === "I" || tagName === "EM") {
          value3 = {
            ...options,
            italic: true,
          };
        } else if (tagName === "U") {
          value3 = {
            ...options,
            underline: true,
          };
        } else if (tagName === "FONT") {
          let value4 = value2.getAttribute("color") ?? "";
          value3 = (0, runtime.isSlideColor)(value4)
            ? {
                ...options,
                color: value4,
              }
            : options;
        } else if (tagName === "A") {
          let value4 = value2.getAttribute("href") ?? "",
            value5 = value2.getAttribute("title") ?? "",
            value6 = /(?:^|\s)(https?:\/\/\S+)$/i.exec(value5)?.[1] ?? "",
            value7 = value4 !== "" ? value4 : value6;
          value3 = (0, runtime.isSafeHyperlink)(value7)
            ? {
                ...options,
                href: value7,
              }
            : options;
        } else if (tagName === "UL" || tagName === "OL") {
          list ??= tagName === "UL" ? "bullet" : "number";
        } else if (tagName === "LI" || tagName === "DIV" || tagName === "P") {
          flag = true;
        }
        if (flag) {
          callback();
        }
        for (let value4 of Array.from(input.childNodes))
          callback2(value4, value3);
        if (flag) {
          callback();
        }
      };
    callback2(element, {});
    if (
      text.endsWith(`
`)
    ) {
      text = text.slice(0, -1);
    }
    if (list === undefined) {
      let value2 = text
        .split(
          `
`,
        )
        .filter((input) => input.trim() !== "");
      if (value2.length > 1) {
        if (value2.every((input) => /^-\s+/.test(input))) {
          list = "bullet";
        } else if (value2.every((input) => /^\d+[.)]\s+/.test(input))) {
          list = "number";
        }
        if (list !== undefined) {
          let index = 0,
            text2 = "",
            items: { at: number; len: number }[] = [];
          for (let value3 of text.split(`
`)) {
            let value4 = /^(-\s+|\d+[.)]\s+)/.exec(value3);
            if (value4 !== null) {
              items.push({
                at: index,
                len: value4[1]!.length,
              });
            }
            index += value3.length + 1;
          }
          let callback3 = (input: number): number => {
            let index2 = 0;
            for (let value3 of items) {
              if (input <= value3.at) {
                break;
              }
              index2 += Math.min(value3.len, input - value3.at);
            }
            return input - index2;
          };
          for (let value3 of marks) {
            value3.start = callback3(value3.start);
            value3.end = callback3(value3.end);
          }
          index = 0;
          text2 = text
            .split(
              `
`,
            )
            .map((input) => input.replace(/^(-\s+|\d+[.)]\s+)/, ""))
            .join(`
`);
          text = text2;
        }
      }
    }
    let value = (0, runtime.normalizeTextMarks)(marks, text);
    return {
      text: text,
      marks: value,
      list: list,
    };
  }
  function readRichTextSelection(
    element: Element,
    node?: (color: string) => string | undefined,
  ): RichTextSelectionFormat | null {
    let selection = window.getSelection();
    if (selection === null || selection.rangeCount === 0) {
      return null;
    }
    let range = selection.getRangeAt(0);
    if (
      !element.contains(range.startContainer) ||
      !element.contains(range.endContainer)
    ) {
      return null;
    }
    let callback = (input: Node): NodeFormat => {
        let state2: NodeFormat = {
            bold: false,
            italic: false,
            underline: false,
          },
          value3: Element | null =
            input.nodeType === 3 ? input.parentElement : (input as Element);
        while (value3 !== null && value3 !== element) {
          let tagName = value3.tagName;
          if (tagName === "A") {
            state2.inLink = true;
          }
          if (tagName === "B" || tagName === "STRONG") {
            state2.bold = true;
          } else if (tagName === "I" || tagName === "EM") {
            state2.italic = true;
          } else if (tagName === "U") {
            state2.underline = true;
          } else if (tagName === "FONT" && state2.color === undefined) {
            let value4 = value3.getAttribute("color") ?? "";
            if ((0, runtime.isSlideColor)(value4)) {
              state2.color = value4;
            }
          } else if (tagName === "A" && state2.href === undefined) {
            let value4 = value3.getAttribute("href") ?? "",
              value5 = value3.getAttribute("title") ?? "",
              value6 = /(?:^|\s)(https?:\/\/\S+)$/i.exec(value5)?.[1] ?? "",
              value7 = value4 !== "" ? value4 : value6;
            if ((0, runtime.isSafeHyperlink)(value7)) {
              state2.href = value7;
            }
          } else if (tagName === "UL" || tagName === "OL") {
            state2.list = tagName === "UL" ? "bullet" : "number";
          }
          value3 = value3.parentElement;
        }
        return state2;
      },
      items: Node[] = [];
    if (range.collapsed) {
      items.push(range.startContainer);
    } else {
      let value3 = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (
        let value4 = value3.nextNode();
        value4 !== null;
        value4 = value3.nextNode()
      ) {
        let value5 = value4 as Text;
        if ((value5.nodeValue ?? "") === "") {
          continue;
        }
        if (!range.intersectsNode(value5)) {
          continue;
        }
        if (
          value5 === range.startContainer &&
          range.startOffset >= value5.length
        ) {
          continue;
        }
        if (value5 === range.endContainer && range.endOffset === 0) {
          continue;
        }
        items.push(value5);
      }
      if (items.length === 0) {
        items.push(range.startContainer);
      }
    }
    let value = items.map(callback),
      value2 = value[0]!,
      state: RichTextSelectionFormat = {
        bold: value.every((input) => input.bold),
        italic: value.every((input) => input.italic),
        underline: value.every((input) => input.underline),
      },
      callback2 = (input: string): string =>
        (node?.(input) ?? input).toLowerCase();
    if (
      value2.color !== undefined &&
      value.every(
        (input) =>
          input.color !== undefined &&
          callback2(input.color) === callback2(value2.color!),
      )
    ) {
      state.color = value2.color;
    }
    if (
      value2.href !== undefined &&
      value.every((input) => input.href === value2.href)
    ) {
      state.href = value2.href;
    }
    if (value.some((input) => input.inLink)) {
      state.touchesLink = true;
    }
    if (
      value2.list !== undefined &&
      value.every((input) => input.list === value2.list)
    ) {
      state.list = value2.list;
    }
    return state;
  }
  function selectionAnchorElements(
    element: Element,
    range: Range,
  ): SelectionAnchors | null {
    let findAnchor = (input: Node): Element | null => {
        let value2: Element | null =
          input.nodeType === 3 ? input.parentElement : (input as Element);
        while (value2 !== null && value2 !== element) {
          if (value2.tagName === "A") {
            return value2;
          }
          value2 = value2.parentElement;
        }
        return null;
      },
      anchors: Node[] = [];
    if (range.collapsed) {
      anchors.push(range.startContainer);
    } else {
      let value2 = element.ownerDocument.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
      );
      for (
        let value3 = value2.nextNode();
        value3 !== null;
        value3 = value2.nextNode()
      ) {
        let value4 = value3 as Text;
        if ((value4.nodeValue ?? "") === "") {
          continue;
        }
        if (!range.intersectsNode(value4)) {
          continue;
        }
        if (
          value4 === range.startContainer &&
          range.startOffset >= value4.length
        ) {
          continue;
        }
        if (value4 === range.endContainer && range.endOffset === 0) {
          continue;
        }
        anchors.push(value4);
      }
      if (anchors.length === 0) {
        anchors.push(range.startContainer);
      }
    }
    let items: Element[] = [];
    for (let value2 of anchors) {
      let value3 = findAnchor(value2);
      if (value3 !== null && !items.includes(value3)) {
        items.push(value3);
      }
    }
    if (items.length === 0) {
      return null;
    }
    for (let value2 of items) {
      if (value2.getAttribute("href") !== null) {
        continue;
      }
      let value3 = value2.getAttribute("title") ?? "",
        value4 = /(?:^|\s)(https?:\/\/\S+)$/i.exec(value3)?.[1] ?? "";
      if ((0, runtime.isSafeHyperlink)(value4)) {
        value2.setAttribute("href", value4);
      }
    }
    let value = element.ownerDocument.createRange();
    value.setStartBefore(items[0]!);
    value.setEndAfter(items[items.length - 1]!);
    return {
      range: value,
      anchors: items,
    };
  }
  function unwrapAnchorElements(anchors: Node[]): void {
    for (let value of anchors) {
      if (!value.isConnected) {
        continue;
      }
      let parentNode = value.parentNode;
      if (parentNode === null) {
        continue;
      }
      while (value.firstChild !== null)
        parentNode.insertBefore(value.firstChild, value);
      parentNode.removeChild(value);
    }
  }
  function clearRichTextUndoState(element: Element): void {
    richTextUndoStates.delete(element);
  }
  function richTextDomFingerprint(element: Node): string {
    let richText = readEditableRichText(element);
    return JSON.stringify([
      richText.text,
      richText.marks ?? null,
      richText.list ?? null,
    ]);
  }
  function reconcileNativeRichTextHistory(
    element: Element,
    event: RichTextInputEvent,
  ): void {
    if (replayingRichTextHistory) {
      return;
    }
    let entry = richTextUndoStates.get(element);
    richTextUndoStates.delete(element);
    if (
      event.inputType === "historyUndo" ||
      event.inputType === "historyRedo"
    ) {
      if (entry === undefined) {
        return;
      }
      let value11 = event.inputType === "historyUndo";
      if (
        !(value11 ? entry.undoArmed : entry.redoArmed) ||
        richTextDomFingerprint(element) !== entry.intermediate
      ) {
        return;
      }
      replayingRichTextHistory = true;
      try {
        document.execCommand(value11 ? "undo" : "redo");
      } finally {
        replayingRichTextHistory = false;
      }
      richTextUndoStates.set(element, {
        intermediate: entry.intermediate,
        undoArmed: !value11,
        redoArmed: value11,
      });
      return;
    }
    if (
      event.inputType !== "insertText" ||
      (event.data !== " " && event.data !== " ")
    ) {
      return;
    }
    let value = window.getSelection();
    if (value === null || value.rangeCount === 0 || !value.isCollapsed) {
      return;
    }
    let value2 = value.getRangeAt(0);
    if (!element.contains(value2.startContainer)) {
      return;
    }
    let value3 = element,
      value4: string | null = null;
    for (
      let value11: Element | null =
        value2.startContainer.nodeType === 3
          ? value2.startContainer.parentElement
          : (value2.startContainer as Element);
      value11 !== null && value11 !== element;
      value11 = value11.parentElement
    ) {
      let tagName = value11.tagName;
      if ((tagName === "UL" || tagName === "OL") && value4 === null) {
        value4 = tagName;
      }
      if (
        value3 === element &&
        (tagName === "DIV" || tagName === "LI" || tagName === "P")
      ) {
        value3 = value11;
      }
    }
    if (value4 === "OL") {
      return;
    }
    let value5 = /^-[ \u00a0]$/,
      callback = (input: string): boolean =>
        value5.test(input.replace(/^\n+/, "")),
      value6 = document.createRange();
    value6.setStart(value3, 0);
    value6.setEnd(value2.startContainer, value2.startOffset);
    let function_toString______native_code___ = value6.toString(),
      value7 = Array.from(value3.querySelectorAll("br"))
        .filter((input) => value6.intersectsNode(input))
        .pop();
    if (value7 !== undefined) {
      value6.setStartAfter(value7);
    }
    let value8 = document.createTreeWalker(value3, NodeFilter.SHOW_TEXT),
      value9: Node | null = null,
      index = 0;
    for (
      let value11 = value8.nextNode();
      value11 !== null;
      value11 = value8.nextNode()
    ) {
      if (!value6.intersectsNode(value11)) {
        continue;
      }
      let data = (value11 as Text).data,
        value12 =
          value11 === value2.startContainer ? value2.startOffset : data.length;
      if (value12 === 0) {
        continue;
      }
      let value13 = data.lastIndexOf(
        `
`,
        value12 - 1,
      );
      if (value13 !== -1) {
        value9 = value11;
        index = value13 + 1;
      }
    }
    if (value9 !== null) {
      value6.setStart(value9, index);
    }
    if (!callback(value6.toString())) {
      return;
    }
    if (value4 !== null && !callback(function_toString______native_code___)) {
      return;
    }
    if (value4 === null) {
      let value11 = readEditableRichText(element);
      if (value11.list === "number") {
        return;
      }
      if (value11.list === "bullet") {
        if (element.querySelector("ul") === null) {
          return;
        }
        if (!callback(function_toString______native_code___)) {
          return;
        }
        value4 = "UL";
      } else if (
        value11.text
          .split(
            `
`,
          )
          .filter((input) => input.trim() !== "").length > 1
      ) {
        return;
      }
    }
    if (value2.startOffset >= 2) {
      value6.setStart(value2.startContainer, value2.startOffset - 2);
    }
    value.removeAllRanges();
    value.addRange(value6);
    document.execCommand("delete");
    if (value4 === "UL") {
      return;
    }
    let value10 = richTextDomFingerprint(element);
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("insertUnorderedList");
    richTextUndoStates.set(element, {
      intermediate: value10,
      undoArmed: true,
      redoArmed: false,
    });
  }
  bindRuntimeValue(runtime, "textRunsForRange", () => textRunsForRange);
  bindRuntimeValue(runtime, "textLinesAsRuns", () => textLinesAsRuns);
  bindRuntimeValue(runtime, "readEditableRichText", () => readEditableRichText);
  bindRuntimeValue(
    runtime,
    "readRichTextSelection",
    () => readRichTextSelection,
  );
  bindRuntimeValue(
    runtime,
    "selectionAnchorElements",
    () => selectionAnchorElements,
  );
  bindRuntimeValue(runtime, "unwrapAnchorElements", () => unwrapAnchorElements);
  bindRuntimeValue(
    runtime,
    "clearRichTextUndoState",
    () => clearRichTextUndoState,
  );
  bindRuntimeValue(
    runtime,
    "richTextDomFingerprint",
    () => richTextDomFingerprint,
  );
  bindRuntimeValue(
    runtime,
    "reconcileNativeRichTextHistory",
    () => reconcileNativeRichTextHistory,
  );
  bindRuntimeValue(
    runtime,
    "richTextUndoStates",
    () => richTextUndoStates,
    (value) => {
      richTextUndoStates = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "replayingRichTextHistory",
    () => replayingRichTextHistory,
    (value) => {
      replayingRichTextHistory = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeRichTextDom",
    () => initializeRichTextDom,
    (value) => {
      initializeRichTextDom = value;
    },
  );
  return () => {
    replayingRichTextHistory = false;
    initializeRichTextDom = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      richTextUndoStates = new WeakMap();
    });
  };
}
