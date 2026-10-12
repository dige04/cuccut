/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorNotesFormatting(
  runtime: RuntimeBindings,
): () => void {
  var NotesFormattingStyledNestsConfig: Dynamic;
  var noteFormattingExecuting: Dynamic;
  var NotesFormattingHandler: Dynamic;
  var NotesFormattingExecCommand: Dynamic;
  var NotesFormattingHandler_2: Dynamic;
  var NotesFormattingGetSelection: Dynamic;
  function getNoteFormattingState(
    input: Dynamic = document,
    options?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
        bold: false,
        italic: false,
        inBold: false,
        inItalic: false,
        allBold: false,
        allItalic: false,
        ul: false,
        ol: false,
      },
      value: Dynamic = input.getSelection(),
      value2: Dynamic =
        value && value.rangeCount > 0 && !value.isCollapsed
          ? value.getRangeAt(0)
          : null;
    !value2 &&
      options &&
      value?.rangeCount &&
      typeof input.queryCommandState == "function" &&
      (!options.bold &&
        input.queryCommandState("bold") &&
        (state.bold = state.inBold = true),
      !options.italic &&
        input.queryCommandState("italic") &&
        (state.italic = state.inItalic = true));
    let value3: Dynamic = null,
      value4: Dynamic = value2
        ? value2.commonAncestorContainer
        : (value?.anchorNode ?? null);
    for (; value4 && value4.nodeType !== 9; value4 = value4.parentNode) {
      if (value4.nodeType !== 1) continue;
      let value5: Dynamic = value4;
      if (value5.contentEditable === "true") {
        value3 = value5;
        break;
      }
      /^(B|STRONG)$/.test(value5.tagName)
        ? (state.bold = state.inBold = true)
        : /^(I|EM)$/.test(value5.tagName)
          ? (state.italic = state.inItalic = true)
          : !state.ul && !state.ol && value5.tagName === "UL"
            ? (state.ul = true)
            : !state.ul &&
              !state.ol &&
              value5.tagName === "OL" &&
              (state.ol = true);
    }
    if (value3 && value2) {
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        [...value3.querySelectorAll(input2)].some(
          (input3?: Dynamic): Dynamic => value2.intersectsNode(input3),
        );
      state.bold ||= callback("b,strong");
      state.italic ||= callback("i,em");
      let flag: Dynamic = true,
        flag2: Dynamic = true,
        flag3: Dynamic = true,
        flag4: Dynamic = true,
        flag5: Dynamic = false,
        value5: Dynamic = input.createTreeWalker(value3, 4);
      for (
        let value6: Dynamic = value5.nextNode();
        value6;
        value6 = value5.nextNode()
      ) {
        if (!value2.intersectsNode(value6)) continue;
        flag5 = true;
        let parentElement: Dynamic = value6.parentElement;
        flag &&= !!parentElement?.closest("b,strong");
        flag2 &&= !!parentElement?.closest("i,em");
        flag3 &&= !!parentElement?.closest("ul");
        flag4 &&= !!parentElement?.closest("ol");
      }
      state.allBold = state.inBold || (flag5 && flag);
      state.allItalic = state.inItalic || (flag5 && flag2);
      !state.ul &&
        !state.ol &&
        ((state.ul = flag5 && flag3), (state.ol = flag5 && !flag3 && flag4));
    } else {
      state.allBold = state.inBold;
      state.allItalic = state.inItalic;
    }
    return state;
  }
  function noteFormattingRefusal(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = document,
    value: Dynamic = NotesFormattingStyledNestsConfig,
  ): Dynamic {
    if (options[input]) return value.styled(input);
    let value2: Dynamic = getNoteFormattingState(context, options);
    return (input === "bold" ? value2.inBold : value2.inItalic)
      ? ""
      : (input === "bold" ? value2.italic : value2.bold)
        ? value.nests
        : "";
  }
  function toggleNoteFormatting(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = document,
  ): Dynamic {
    noteFormattingRefusal(input, options, context) === "" &&
      (NotesFormattingGetSelection(context),
      NotesFormattingExecCommand(context, input));
  }
  function toggleNoteList(
    input?: Dynamic,
    options: Dynamic = document,
  ): Dynamic {
    NotesFormattingGetSelection(options);
    let value: Dynamic = options.getSelection(),
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic =
          input2?.nodeType === 1 ? input2 : (input2?.parentElement ?? null);
        return (
          value4?.closest("li") ??
          value4?.closest('[contenteditable="true"] > *') ??
          null
        );
      },
      value2: Dynamic = -1;
    if (value && value.isCollapsed && value.anchorNode) {
      let value4: Dynamic = callback(value.anchorNode);
      if (value4) {
        let value5: Dynamic = options.createRange();
        value5.selectNodeContents(value4);
        value5.setEnd(value.anchorNode, value.anchorOffset);
        value2 = value5.toString().length;
      }
    }
    NotesFormattingExecCommand(
      options,
      input === "ul" ? "insertUnorderedList" : "insertOrderedList",
    );
    let value3: Dynamic =
      value2 >= 0 && value?.anchorNode ? callback(value.anchorNode) : null;
    if (value3 && value) {
      let value4: Dynamic = options.createTreeWalker(value3, 4);
      for (
        let value5: Dynamic = value4.nextNode(), value6: Dynamic = value2;
        value5;
        value5 = value4.nextNode()
      ) {
        let length: Dynamic = (value5.nodeValue ?? "").length,
          value7: Dynamic = value5.parentElement?.closest(
            '[contenteditable="false"]',
          );
        if (value6 <= length && !value7) {
          value.collapse(value5, value6);
          break;
        }
        if (value6 <= length && value7?.parentNode) {
          value.collapse(
            value7.parentNode,
            [...value7.parentNode.childNodes].indexOf(value7) + 1,
          );
          break;
        }
        value6 -= length;
      }
    }
  }
  bindRuntimeValue(
    runtime,
    "getNoteFormattingState",
    () => getNoteFormattingState,
  );
  bindRuntimeValue(
    runtime,
    "NotesFormattingStyledNestsConfig",
    () => NotesFormattingStyledNestsConfig,
    (value) => {
      NotesFormattingStyledNestsConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noteFormattingRefusal",
    () => noteFormattingRefusal,
  );
  bindRuntimeValue(
    runtime,
    "noteFormattingExecuting",
    () => noteFormattingExecuting,
    (value) => {
      noteFormattingExecuting = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesFormattingHandler",
    () => NotesFormattingHandler,
    (value) => {
      NotesFormattingHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesFormattingExecCommand",
    () => NotesFormattingExecCommand,
    (value) => {
      NotesFormattingExecCommand = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesFormattingHandler_2",
    () => NotesFormattingHandler_2,
    (value) => {
      NotesFormattingHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesFormattingGetSelection",
    () => NotesFormattingGetSelection,
    (value) => {
      NotesFormattingGetSelection = value;
    },
  );
  bindRuntimeValue(runtime, "toggleNoteFormatting", () => toggleNoteFormatting);
  bindRuntimeValue(runtime, "toggleNoteList", () => toggleNoteList);
  return () => {
    NotesFormattingStyledNestsConfig = {
      styled: (input?: Dynamic): Dynamic =>
        "The whole note is already " + input + " (its style)",
      nests: "Bold and italic do not combine in a note",
    };
    noteFormattingExecuting = false;
    NotesFormattingHandler = (): Dynamic => noteFormattingExecuting;
    NotesFormattingExecCommand = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      noteFormattingExecuting = true;
      try {
        input.execCommand("styleWithCSS", false, "false");
        input.execCommand(options);
      } finally {
        noteFormattingExecuting = false;
      }
    };
    NotesFormattingHandler_2 = (input?: Dynamic): Dynamic =>
      (input?.nodeType === 1 ? input : (input?.parentElement ?? null))?.closest(
        '[contenteditable="true"]',
      ) ?? null;
    NotesFormattingGetSelection = (input: Dynamic = document): Dynamic => {
      let value: Dynamic = NotesFormattingHandler_2(
        input.getSelection()?.anchorNode,
      );
      value && input.activeElement !== value && value.focus();
    };
  };
}
