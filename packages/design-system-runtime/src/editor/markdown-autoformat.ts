import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorMarkdownAutoformat(
  runtime: RuntimeBindings,
): () => void {
  var MARKDOWN_BLOCK_SHORTCUTS: [string, M.MarkdownShortcutBlock][];
  var markdownAutoformatCache: WeakMap<HTMLElement, M.MarkdownAutoformatState>;
  var markdownAutoformatExecuting: boolean;
  function noteAutoformatShortcut(
    text: string,
    trimIndent = false,
  ): M.MarkdownShortcutBlock | null {
    let value = text.replace(/\u00a0/g, " ");
    if (trimIndent) {
      value = value.replace(/^ +/, "");
      if (value === "• ") {
        return "ul";
      }
      if (/^\d{1,3}\. $/.test(value)) {
        return "ol";
      }
    }
    for (let [value2, value3] of MARKDOWN_BLOCK_SHORTCUTS) {
      if (value === value2) {
        return value3;
      }
    }
    return null;
  }
  function executeMarkdownBlockFormat(
    document2: Document,
    blockType: M.MarkdownShortcutBlock,
  ): void {
    document2.execCommand("styleWithCSS", false, "false");
    if (blockType === "ul") {
      document2.execCommand("insertUnorderedList");
    } else if (blockType === "ol") {
      document2.execCommand("insertOrderedList");
    } else if (blockType === "quote") {
      document2.execCommand("formatBlock", false, "BLOCKQUOTE");
    } else {
      document2.execCommand("formatBlock", false, blockType.toUpperCase());
    }
  }
  function autoformatMarkdownBlock(
    root: HTMLElement,
    event: Pick<InputEvent, "inputType" | "data">,
    serializeRoot: (root: HTMLElement) => string,
    allowedBlocks?: readonly M.MarkdownShortcutBlock[],
    extendedShortcuts = false,
  ): boolean {
    if (markdownAutoformatExecuting) {
      return false;
    }
    let document2 = root.ownerDocument,
      cachedState = markdownAutoformatCache.get(root);
    markdownAutoformatCache.delete(root);
    if (
      event.inputType === "historyUndo" ||
      event.inputType === "historyRedo"
    ) {
      if (cachedState === undefined) {
        return false;
      }
      let value: boolean = event.inputType === "historyUndo";
      if (!(value ? cachedState.undoArmed : cachedState.redoArmed)) {
        return false;
      }
      if (serializeRoot(root) !== cachedState.intermediate) {
        return false;
      }
      markdownAutoformatExecuting = true;
      try {
        document2.execCommand(value ? "undo" : "redo");
      } finally {
        markdownAutoformatExecuting = false;
      }
      markdownAutoformatCache.set(root, {
        ...cachedState,
        undoArmed: !value,
        redoArmed: value,
      });
      return false;
    }
    if (
      event.inputType !== "insertText" ||
      (event.data !== " " && event.data !== " ")
    ) {
      return false;
    }
    let selection = document2.getSelection();
    if (
      selection === null ||
      selection.rangeCount === 0 ||
      !selection.isCollapsed
    ) {
      return false;
    }
    let selectionRange = selection.getRangeAt(0);
    if (!root.contains(selectionRange.startContainer)) {
      return false;
    }
    let paragraph: Element = root,
      ancestor: Element | null =
        selectionRange.startContainer.nodeType === 3
          ? selectionRange.startContainer.parentElement
          : (selectionRange.startContainer as Element);
    for (
      ;
      ancestor !== null && ancestor !== root;
      ancestor = ancestor.parentElement
    ) {
      if (
        /^(LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|TABLE|CODE|A)$/.test(ancestor.tagName)
      ) {
        return false;
      }
      if (
        paragraph === root &&
        (ancestor.tagName === "DIV" || ancestor.tagName === "P")
      ) {
        paragraph = ancestor;
      }
    }
    let prefixRange = document2.createRange();
    prefixRange.selectNodeContents(paragraph);
    prefixRange.setEnd(
      selectionRange.startContainer,
      selectionRange.startOffset,
    );
    if (
      prefixRange.cloneContents().querySelector('[contenteditable="false"]')
    ) {
      return false;
    }
    let shortcutBlock = noteAutoformatShortcut(
      prefixRange.toString(),
      extendedShortcuts,
    );
    if (
      shortcutBlock === null ||
      (allowedBlocks !== undefined && !allowedBlocks.includes(shortcutBlock))
    ) {
      return false;
    }
    let orderedListStart =
      extendedShortcuts && shortcutBlock === "ol"
        ? Number.parseInt(prefixRange.toString().trim(), 10)
        : 1;
    selection.removeAllRanges();
    selection.addRange(prefixRange);
    document2.execCommand("delete");
    let intermediate = serializeRoot(root);
    executeMarkdownBlockFormat(document2, shortcutBlock);
    if (orderedListStart > 1) {
      let value = document2.getSelection()?.anchorNode ?? null,
        value2 = (
          value?.nodeType === 1 ? (value as Element) : value?.parentElement
        )?.closest("li")?.parentElement;
      if (value2?.tagName === "OL" && value2.childElementCount === 1) {
        value2.setAttribute("start", String(orderedListStart));
      }
    }
    markdownAutoformatCache.set(root, {
      intermediate: intermediate,
      undoArmed: true,
      redoArmed: false,
    });
    return true;
  }
  bindRuntimeValue(
    runtime,
    "MARKDOWN_BLOCK_SHORTCUTS",
    () => MARKDOWN_BLOCK_SHORTCUTS,
    (value) => {
      MARKDOWN_BLOCK_SHORTCUTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noteAutoformatShortcut",
    () => noteAutoformatShortcut,
  );
  bindRuntimeValue(
    runtime,
    "markdownAutoformatCache",
    () => markdownAutoformatCache,
    (value) => {
      markdownAutoformatCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markdownAutoformatExecuting",
    () => markdownAutoformatExecuting,
    (value) => {
      markdownAutoformatExecuting = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "executeMarkdownBlockFormat",
    () => executeMarkdownBlockFormat,
  );
  bindRuntimeValue(
    runtime,
    "autoformatMarkdownBlock",
    () => autoformatMarkdownBlock,
  );
  return () => {
    MARKDOWN_BLOCK_SHORTCUTS = [
      ["# ", "h1"],
      ["## ", "h2"],
      ["### ", "h3"],
      ["- ", "ul"],
      ["* ", "ul"],
      ["1. ", "ol"],
      ["> ", "quote"],
    ];
    markdownAutoformatCache = new WeakMap();
    markdownAutoformatExecuting = false;
  };
}
