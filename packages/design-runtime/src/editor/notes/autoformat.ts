/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorNotesAutoformat(
  runtime: RuntimeBindings,
): () => void {
  var NotesAutoformatItems: Dynamic;
  var NotesAutoformatElementCache: Dynamic;
  var noteAutoformatExecuting: Dynamic;
  var ContenteditableFalseValue: Dynamic;
  var NotesAutoformatParentNode: Dynamic;
  var NotesAutoformatCaretPositionFromPoint: Dynamic;
  var NotesAutoformatExecCommand: Dynamic;
  var NotesAutoformatOnPasteOnDropOnDragStartConfig: Dynamic;
  function noteAutoformatShortcut(
    input?: Dynamic,
    options: Dynamic = false,
  ): Dynamic {
    let value: Dynamic = input.replace(/\u00a0/g, " ");
    if (options) {
      value = value.replace(/^ +/, "");
      if (value === "\u2022 ") return "ul";
      if (/^\d{1,3}\. $/.test(value)) return "ol";
    }
    for (let [value2, value3] of NotesAutoformatItems as Dynamic)
      if (value === value2) return value3;
    return null;
  }
  function applyNoteAutoformat(input?: Dynamic, options?: Dynamic): Dynamic {
    input.execCommand("styleWithCSS", false, "false");
    options === "ul"
      ? input.execCommand("insertUnorderedList")
      : options === "ol"
        ? input.execCommand("insertOrderedList")
        : options === "quote"
          ? input.execCommand("formatBlock", false, "BLOCKQUOTE")
          : input.execCommand("formatBlock", false, options.toUpperCase());
  }
  function handleNoteAutoformat(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = false,
  ): Dynamic {
    if (noteAutoformatExecuting) return false;
    let ownerDocument: Dynamic = element.ownerDocument,
      entry: Dynamic = NotesAutoformatElementCache.get(element);
    NotesAutoformatElementCache.delete(element);
    if (
      options.inputType === "historyUndo" ||
      options.inputType === "historyRedo"
    ) {
      if (entry === undefined) return false;
      let value10: Dynamic = options.inputType === "historyUndo";
      if (
        !(value10 ? entry.undoArmed : entry.redoArmed) ||
        context(element) !== entry.intermediate
      )
        return false;
      noteAutoformatExecuting = true;
      try {
        ownerDocument.execCommand(value10 ? "undo" : "redo");
      } finally {
        noteAutoformatExecuting = false;
      }
      NotesAutoformatElementCache.set(element, {
        ...entry,
        undoArmed: !value10,
        redoArmed: value10,
      });
      return false;
    }
    if (
      options.inputType !== "insertText" ||
      (options.data !== " " && options.data !== "\xA0")
    )
      return false;
    let value2: Dynamic = ownerDocument.getSelection();
    if (value2 === null || value2.rangeCount === 0 || !value2.isCollapsed)
      return false;
    let value3: Dynamic = value2.getRangeAt(0);
    if (!element.contains(value3.startContainer)) return false;
    let value4: Dynamic = element,
      value5: Dynamic =
        value3.startContainer.nodeType === 3
          ? value3.startContainer.parentElement
          : value3.startContainer;
    for (
      ;
      value5 !== null && value5 !== element;
      value5 = value5.parentElement
    ) {
      if (
        /^(LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|TABLE|CODE|A)$/.test(value5.tagName)
      )
        return false;
      value4 === element &&
        (value5.tagName === "DIV" || value5.tagName === "P") &&
        (value4 = value5);
    }
    let value6: Dynamic = ownerDocument.createRange();
    value6.selectNodeContents(value4);
    value6.setEnd(value3.startContainer, value3.startOffset);
    if (value6.cloneContents().querySelector('[contenteditable="false"]'))
      return false;
    let value7: Dynamic = noteAutoformatShortcut(value6.toString(), extra);
    if (value7 === null || (value !== undefined && !value.includes(value7)))
      return false;
    let value8: Dynamic =
      extra && value7 === "ol"
        ? Number.parseInt(value6.toString().trim(), 10)
        : 1;
    value2.removeAllRanges();
    value2.addRange(value6);
    ownerDocument.execCommand("delete");
    let value9: Dynamic = context(element);
    applyNoteAutoformat(ownerDocument, value7);
    if (value8 > 1) {
      let value10: Dynamic = ownerDocument.getSelection()?.anchorNode ?? null,
        value11: Dynamic = (
          value10?.nodeType === 1 ? value10 : value10?.parentElement
        )?.closest("li")?.parentElement;
      value11?.tagName === "OL" &&
        value11.childElementCount === 1 &&
        value11.setAttribute("start", String(value8));
    }
    NotesAutoformatElementCache.set(element, {
      intermediate: value9,
      undoArmed: true,
      redoArmed: false,
    });
    return true;
  }
  function installNoteInputRules(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (event?: Dynamic): Dynamic => {
      if (
        (0, runtime.NotesFormattingHandler)() ||
        typeof event.inputType != "string"
      )
        return;
      if (
        context?.lists === false &&
        /^insert(Un)?orderedList$/i.test(event.inputType)
      )
        return event.preventDefault();
      if (!event.inputType.startsWith("format")) return;
      event.preventDefault();
      let value: Dynamic = options();
      value &&
        (event.inputType === "formatBold" ||
          event.inputType === "formatItalic") &&
        (0, runtime.toggleNoteFormatting)(
          event.inputType === "formatBold" ? "bold" : "italic",
          value,
        );
    };
    input.addEventListener("beforeinput", callback);
    return (): Dynamic => input.removeEventListener("beforeinput", callback);
  }
  function handleNoteFormattingShortcut(
    event?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (
      !(event.metaKey || event.ctrlKey) ||
      event.altKey ||
      event.shiftKey ||
      !/^[biu]$/i.test(event.key)
    )
      return false;
    event.preventDefault();
    let value: Dynamic = event.key.toLowerCase();
    options &&
      value !== "u" &&
      (0, runtime.toggleNoteFormatting)(
        value === "b" ? "bold" : "italic",
        options,
      );
    return true;
  }
  function moveNoteCaretToEnd(input?: Dynamic): Dynamic {
    let value: Dynamic = (window as Dynamic).getSelection();
    if (!value || !input.lastChild) return false;
    let value2: Dynamic = input;
    for (
      ;
      value2.lastChild && /^(DIV|UL|OL|LI)$/.test(value2.lastChild.nodeName);

    )
      value2 = value2.lastChild;
    let value3: Dynamic = (document as Dynamic).createRange();
    value3.selectNodeContents(value2);
    value3.collapse(false);
    value.removeAllRanges();
    value.addRange(value3);
    return true;
  }
  bindRuntimeValue(
    runtime,
    "NotesAutoformatItems",
    () => NotesAutoformatItems,
    (value) => {
      NotesAutoformatItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noteAutoformatShortcut",
    () => noteAutoformatShortcut,
  );
  bindRuntimeValue(
    runtime,
    "NotesAutoformatElementCache",
    () => NotesAutoformatElementCache,
    (value) => {
      NotesAutoformatElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noteAutoformatExecuting",
    () => noteAutoformatExecuting,
    (value) => {
      noteAutoformatExecuting = value;
    },
  );
  bindRuntimeValue(runtime, "applyNoteAutoformat", () => applyNoteAutoformat);
  bindRuntimeValue(runtime, "handleNoteAutoformat", () => handleNoteAutoformat);
  bindRuntimeValue(
    runtime,
    "ContenteditableFalseValue",
    () => ContenteditableFalseValue,
    (value) => {
      ContenteditableFalseValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesAutoformatParentNode",
    () => NotesAutoformatParentNode,
    (value) => {
      NotesAutoformatParentNode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesAutoformatCaretPositionFromPoint",
    () => NotesAutoformatCaretPositionFromPoint,
    (value) => {
      NotesAutoformatCaretPositionFromPoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installNoteInputRules",
    () => installNoteInputRules,
  );
  bindRuntimeValue(
    runtime,
    "handleNoteFormattingShortcut",
    () => handleNoteFormattingShortcut,
  );
  bindRuntimeValue(
    runtime,
    "NotesAutoformatExecCommand",
    () => NotesAutoformatExecCommand,
    (value) => {
      NotesAutoformatExecCommand = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesAutoformatOnPasteOnDropOnDragStartConfig",
    () => NotesAutoformatOnPasteOnDropOnDragStartConfig,
    (value) => {
      NotesAutoformatOnPasteOnDropOnDragStartConfig = value;
    },
  );
  bindRuntimeValue(runtime, "moveNoteCaretToEnd", () => moveNoteCaretToEnd);
  return () => {
    NotesAutoformatItems = [
      ["# ", "h1"],
      ["## ", "h2"],
      ["### ", "h3"],
      ["- ", "ul"],
      ["* ", "ul"],
      ["1. ", "ol"],
      ["> ", "quote"],
    ];
    NotesAutoformatElementCache = new WeakMap();
    noteAutoformatExecuting = false;
    ContenteditableFalseValue = '[contenteditable="false"]';
    NotesAutoformatParentNode = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let parentNode: Dynamic = options.parentNode;
      input.collapse(
        parentNode,
        [...parentNode.childNodes].indexOf(options) + 1,
      );
    };
    NotesAutoformatCaretPositionFromPoint = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let value: Dynamic = (document as Dynamic).caretPositionFromPoint?.(
        input,
        options,
      );
      if (value) return [value.offsetNode, value.offset];
      let value2: Dynamic = (document as Dynamic).caretRangeFromPoint?.(
        input,
        options,
      );
      return value2 ? [value2.startContainer, value2.startOffset] : null;
    };
    NotesAutoformatExecCommand = (input?: Dynamic): Dynamic => {
      input && (document as Dynamic).execCommand("insertText", false, input);
    };
    NotesAutoformatOnPasteOnDropOnDragStartConfig = {
      onPaste: (event?: Dynamic): Dynamic => {
        event.preventDefault();
        NotesAutoformatExecCommand(event.clipboardData.getData("text/plain"));
      },
      onDrop: (event?: Dynamic): Dynamic => {
        event.preventDefault();
        event.stopPropagation();
        NotesAutoformatExecCommand(event.dataTransfer.getData("text/plain"));
      },
      onDragStart: (event?: Dynamic): Dynamic => event.preventDefault(),
      onDragOver: (event?: Dynamic): Dynamic => {
        event.preventDefault();
        event.stopPropagation();
      },
    };
  };
}
