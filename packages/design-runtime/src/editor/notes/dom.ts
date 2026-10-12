/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorNotesDom(runtime: RuntimeBindings): () => void {
  var NotesDomRepeat: Dynamic;
  var NotesDomHandler: Dynamic;
  var NotesDomBSTRONGIConfig: Dynamic;
  var NotesDomBLOCKQUOTESECTIONPattern: Dynamic;
  var NotesDomHttpsPattern: Dynamic;
  var NotesDomJoin: Dynamic;
  var NotesDomReplace: Dynamic;
  var NotesDomHandler_2: Dynamic;
  function createNoteInlineDom(
    doc?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.NotesBlocksHandler)(options, context);
    return value.every((input?: Dynamic): Dynamic => input.text === "")
      ? [doc.createElement("br")]
      : value.map((source?: Dynamic): Dynamic => {
          if (source.kind === "text") return doc.createTextNode(source.text);
          let value2: Dynamic = doc.createElement(
            (
              {
                bold: "strong",
                italic: "em",
                code: "code",
                link: "a",
              } as Dynamic
            )[source.kind],
          );
          value2.textContent = source.text;
          (source.kind === "code" || source.kind === "link") &&
            (value2.contentEditable = "false");
          source.kind === "link" &&
            ((value2.dataset.href = source.href), (value2.title = source.href));
          return value2;
        });
  }
  function applyNoteMarkdownDom(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let ownerDocument: Dynamic = element.ownerDocument;
    element.replaceChildren();
    for (let value of (0, runtime.parseNoteBlocks)(
      options,
      context,
    ) as Dynamic) {
      if (value.kind === "p") {
        let value3: Dynamic = ownerDocument.createElement("div");
        value3.append(
          ...createNoteInlineDom(ownerDocument, value.text, context?.linksTo),
        );
        element.append(value3);
        continue;
      }
      let value2: Dynamic = ownerDocument.createElement(value.kind);
      value.kind === "ol" &&
        value.start !== 1 &&
        value2.setAttribute("start", String(value.start));
      for (let value3 of value.items as Dynamic) {
        let value4: Dynamic = ownerDocument.createElement("li");
        value4.append(
          ...createNoteInlineDom(ownerDocument, value3, context?.linksTo),
        );
        value2.append(value4);
      }
      element.append(value2);
    }
  }
  function serializeNoteDom(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options?.lists !== false,
      items: Dynamic = [],
      text: Dynamic = "",
      items2: Dynamic = [],
      value2: Dynamic = null,
      value3: Dynamic = null,
      flag: Dynamic = false,
      state: Dynamic = {
        bold: "**",
        italic: "*",
        code: "`",
      },
      callback: Dynamic = (): Dynamic => {
        if (!value2) return;
        let [, value4 = "", value5 = "", value6 = ""]: Dynamic =
          (value2.k === "code" ? /^()(.*)()$/s : /^(\s*)(.*?)(\s*)$/s).exec(
            value2.text,
          ) ?? [];
        value5 === "" || (value2.k === "code" && !NotesDomHandler(value5))
          ? items2.push({
              k: "text",
              text: value2.text,
            })
          : items2.push(
              {
                k: "text",
                text: value4,
              },
              {
                k: value2.k,
                text: value5,
              },
              {
                k: "text",
                text: value6,
              },
            );
        value2 = null;
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        let items3: Dynamic = [];
        for (let value4 of input2 as Dynamic) {
          let value5: Dynamic = items3[items3.length - 1];
          value4.k === "text" && value5?.k === "text"
            ? (value5.text += value4.text)
            : (value4.text !== "" || value4.k !== "text") &&
              items3.push({
                ...value4,
              });
        }
        return items3
          .map(
            (input3?: Dynamic): Dynamic =>
              input3.k + "" + input3.text + "" + (input3.href ?? ""),
          )
          .join("");
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.replace(/[\\[\]]/g, "\\$&"),
      callback4: Dynamic = (input2?: Dynamic): Dynamic => {
        let items3: Dynamic = [];
        for (let value4 of input2 as Dynamic) {
          value4.k === "code" &&
            items3[items3.length - 1]?.k === "code" &&
            items3.push({
              k: "text",
              text: " ",
            });
          items3.push(value4);
        }
        return items3;
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic =>
        input2
          .map(
            (input3?: Dynamic): Dynamic =>
              input3.k === "text"
                ? (0, runtime.escapeMarkdownInline)(input3.text)
                : input3.k === "link"
                  ? "[" +
                    callback3(input3.text) +
                    "](" +
                    (input3.href ?? "").replace(/[\\[]/g, "\\$&") +
                    ")"
                  : input3.k === "code"
                    ? (NotesDomRepeat(input3.text) ??
                      (0, runtime.escapeMarkdownInline)(input3.text))
                    : state[input3.k] +
                      (0, runtime.escapeMarkdownInline)(input3.text) +
                      state[input3.k],
          )
          .join(""),
      callback6: Dynamic = (): Dynamic => {
        callback();
        if (flag) {
          items2 = callback4(items2);
          let value4: Dynamic = callback5(items2);
          text === "" &&
            value &&
            (value4 = (0, runtime.NotesBlocksReplace)(value4));
          callback2(callback7(value4)) !== callback2(items2) &&
            (value4 = callback5(
              items2.map(
                (input2?: Dynamic): Dynamic =>
                  input2.k === "bold" || input2.k === "italic"
                    ? {
                        k: "text",
                        text: input2.text,
                      }
                    : input2,
              ),
            ));
          items.push(text + value4);
        }
        items2 = [];
        flag = false;
      },
      callback7: Dynamic = (input2?: Dynamic): Dynamic =>
        (0, runtime.NotesBlocksHandler)(
          value ? input2.replace(runtime.NotesBlocksPattern_3, "$1$2") : input2,
        ).map(
          (source?: Dynamic): Dynamic => ({
            k: source.kind,
            text: source.text,
            href: source.kind === "link" ? source.href : undefined,
          }),
        ),
      callback8: Dynamic = (input2?: Dynamic): Dynamic => {
        input2
          .replace(/\u00a0/g, " ")
          .split(
            `
`,
          )
          .forEach((input3?: Dynamic, options2?: Dynamic): Dynamic => {
            options2 > 0 && ((flag = true), callback6());
            input3 !== "" &&
              (value3
                ? ((value2 ??= {
                    k: value3.k,
                    text: "",
                  }).text += input3)
                : items2.push({
                    k: "text",
                    text: input3,
                  }),
              (flag = true));
          });
      },
      callback9: Dynamic = (input2?: Dynamic): Dynamic => {
        let parentElement: Dynamic = input2.parentElement;
        if (!parentElement) return "";
        if (parentElement.tagName !== "OL") return "- ";
        let value4: Dynamic = Number.parseInt(
            parentElement.getAttribute("start") ?? "1",
            10,
          ),
          value5: Dynamic = Number.isFinite(value4) && value4 >= 0 ? value4 : 1;
        for (
          let previousElementSibling: Dynamic = input2.previousElementSibling;
          previousElementSibling;
          previousElementSibling = previousElementSibling.previousElementSibling
        )
          previousElementSibling.tagName === "LI" && (value5 += 1);
        return String(Math.min(value5, 999)) + ". ";
      },
      callback10: Dynamic = (input2?: Dynamic): Dynamic => {
        if (input2.nodeType === 3) {
          callback8(input2.nodeValue ?? "");
          return;
        }
        if (input2.nodeType !== 1) return;
        let value4: Dynamic = input2,
          tagName: Dynamic = value4.tagName;
        if (tagName === "BR") {
          let parentElement: Dynamic = value4.parentElement,
            value8: Dynamic =
              parentElement !== null &&
              (parentElement === input ||
                NotesDomBLOCKQUOTESECTIONPattern.test(parentElement.tagName));
          if (
            value8 &&
            value4.previousSibling === null &&
            value4.nextSibling?.contentEditable === "false"
          )
            return;
          value8 && value4.nextSibling === null
            ? (flag = true)
            : ((flag = true), callback6());
          return;
        }
        if (NotesDomBLOCKQUOTESECTIONPattern.test(tagName)) {
          callback6();
          let value8: Dynamic = text;
          tagName === "LI" && value && (text = callback9(value4));
          let length: Dynamic = items.length;
          value4.childNodes.forEach(callback10);
          tagName === "LI" && items.length === length && (flag = true);
          callback6();
          text = value8;
          return;
        }
        let value5: Dynamic = (value4.textContent ?? "").replace(
            /[\n\u00a0]/g,
            " ",
          ),
          value6: Dynamic =
            tagName === "A" &&
            NotesDomHttpsPattern.test(value4.dataset.href ?? "") &&
            value5 !== ""
              ? {
                  k: "link",
                  text: value5,
                  href: value4.dataset.href ?? "",
                }
              : tagName === "CODE" && value5 !== "" && NotesDomHandler(value5)
                ? {
                    k: "code",
                    text: value5,
                  }
                : null;
        if (value6 !== null) {
          callback();
          items2.push(value6);
          flag = true;
          return;
        }
        if (tagName === "A") {
          value4.childNodes.forEach(callback10);
          return;
        }
        let value7: Dynamic = NotesDomBSTRONGIConfig[tagName];
        if (value7 !== undefined && value3 === null) {
          value3 = {
            k: value7,
          };
          value4.childNodes.forEach(callback10);
          callback();
          value3 = null;
          return;
        }
        value4.childNodes.forEach(callback10);
      };
    input.childNodes.forEach(callback10);
    callback6();
    return items.join(`
`);
  }
  function normalizeNoteLineBreaks(input?: Dynamic): Dynamic {
    for (let value of [...input.querySelectorAll("br")] as Dynamic) {
      let value2: Dynamic = value.nextSibling?.contentEditable === "false";
      value2 && value.previousSibling === null && value.parentElement !== input
        ? (value.dataset.notePh = "")
        : value.dataset.notePh !== undefined &&
          (value.previousSibling !== null || !value2) &&
          value.remove();
    }
  }
  bindRuntimeValue(runtime, "createNoteInlineDom", () => createNoteInlineDom);
  bindRuntimeValue(runtime, "applyNoteMarkdownDom", () => applyNoteMarkdownDom);
  bindRuntimeValue(
    runtime,
    "NotesDomRepeat",
    () => NotesDomRepeat,
    (value) => {
      NotesDomRepeat = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesDomHandler",
    () => NotesDomHandler,
    (value) => {
      NotesDomHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesDomBSTRONGIConfig",
    () => NotesDomBSTRONGIConfig,
    (value) => {
      NotesDomBSTRONGIConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesDomBLOCKQUOTESECTIONPattern",
    () => NotesDomBLOCKQUOTESECTIONPattern,
    (value) => {
      NotesDomBLOCKQUOTESECTIONPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesDomHttpsPattern",
    () => NotesDomHttpsPattern,
    (value) => {
      NotesDomHttpsPattern = value;
    },
  );
  bindRuntimeValue(runtime, "serializeNoteDom", () => serializeNoteDom);
  bindRuntimeValue(
    runtime,
    "normalizeNoteLineBreaks",
    () => normalizeNoteLineBreaks,
  );
  bindRuntimeValue(
    runtime,
    "NotesDomJoin",
    () => NotesDomJoin,
    (value) => {
      NotesDomJoin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesDomReplace",
    () => NotesDomReplace,
    (value) => {
      NotesDomReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesDomHandler_2",
    () => NotesDomHandler_2,
    (value) => {
      NotesDomHandler_2 = value;
    },
  );
  return () => {
    NotesDomRepeat = (input?: Dynamic): Dynamic => {
      let value: Dynamic = "`".repeat(
        (input.match(/\u0060+/g) ?? []).reduce(
          (input2?: Dynamic, items?: Dynamic): Dynamic =>
            Math.max(input2, items.length),
          0,
        ) + 1,
      );
      for (let value2 of ["", " "] as Dynamic) {
        let value3: Dynamic = value + value2 + input + value2 + value,
          value4: Dynamic = (0, runtime.NotesBlocksHandler)(value3);
        if (
          value4.length === 1 &&
          value4[0]?.kind === "code" &&
          value4[0].text === input
        )
          return value3;
      }
      return null;
    };
    NotesDomHandler = (input?: Dynamic): Dynamic =>
      NotesDomRepeat(input) !== null;
    NotesDomBSTRONGIConfig = {
      B: "bold",
      STRONG: "bold",
      I: "italic",
      EM: "italic",
      CODE: "code",
    };
    NotesDomBLOCKQUOTESECTIONPattern =
      /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|TABLE|TR)$/;
    NotesDomHttpsPattern = /^https?:\/\/[^)\s]*$/;
    NotesDomJoin = (input?: Dynamic): Dynamic =>
      input
        .split(
          `
`,
        )
        .map(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.NotesBlocksReplace)(
              (0, runtime.escapeMarkdownInline)(input2),
            ),
        ).join(`
`);
    NotesDomReplace = (input?: Dynamic): Dynamic =>
      input
        .split(
          `
`,
        )
        .map(
          (input2?: Dynamic): Dynamic =>
            input2.replace(runtime.NotesBlocksPattern_3, "$1$2"),
        )
        .join(
          `
`,
        )
        .replace(/\\([*\u0060[\]\\])/g, "$1");
    NotesDomHandler_2 = (input?: Dynamic): Dynamic => {
      let value: Dynamic = NotesDomReplace(input);
      return NotesDomJoin(value) === input ? value : input;
    };
  };
}
