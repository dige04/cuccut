/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorNotesInlineMarkdown(
  runtime: RuntimeBindings,
): () => void {
  var jsxNotesInlineMarkdown: Dynamic;
  var NotesInlineMarkdownPattern: Dynamic;
  var Value_4: Dynamic;
  var NotesInlineMarkdownUFDDUFDDPattern: Dynamic;
  var NotesInlineMarkdownReplace: Dynamic;
  var NotesInlineMarkdownReplace_2: Dynamic;
  function trimCodeSpanPadding(input?: Dynamic, options?: Dynamic): Dynamic {
    if (
      options.to - options.from > 2 &&
      input.charCodeAt(options.from) === 32 &&
      input.charCodeAt(options.to - 1) === 32
    ) {
      let from: Dynamic = options.from;
      for (; from < options.to && input.charCodeAt(from) === 32; ) from++;
      let value: Dynamic = options.to - 1;
      for (; value > from && input.charCodeAt(value) === 32; ) value--;
      if (
        from < options.to &&
        (input.charCodeAt(from) === 96 || input.charCodeAt(value) === 96)
      )
        return input.slice(options.from + 1, options.to - 1);
    }
    return input.slice(options.from, options.to);
  }
  function scanMarkdownCodeSpans(items?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      items3: Dynamic = [];
    for (let index2: Dynamic = 0; index2 < items.length; ) {
      if (items.charCodeAt(index2) !== 96) {
        index2++;
        continue;
      }
      let value2: Dynamic = index2;
      for (; value2 < items.length && items.charCodeAt(value2) === 96; )
        value2++;
      items2.push(index2);
      items3.push(value2 - index2);
      index2 = value2;
    }
    let value: Dynamic = new Array(items2.length).fill(-1),
      entries: Dynamic = new Map();
    for (let value2: Dynamic = items2.length - 1; value2 >= 0; value2--) {
      value[value2] = entries.get(items3[value2]) ?? -1;
      entries.set(items3[value2], value2);
    }
    let index: Dynamic = 0;
    return (input?: Dynamic): Dynamic => {
      for (; index < items2.length; index++) {
        let value2: Dynamic = items2[index];
        if (value2 < input) continue;
        let value3: Dynamic = value[index];
        if (value3 < 0) continue;
        let value4: Dynamic = items3[index];
        return {
          start: value2,
          end: items2[value3] + value4,
          from: value2 + value4,
          to: items2[value3],
        };
      }
    };
  }
  function escapeMarkdownInline(input?: Dynamic): Dynamic {
    return input.replace(/[*\u0060[\]\\]/g, "\\$&");
  }
  function parseNoteInlineMarkdown(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [],
      value: Dynamic =
        options?.escapes === true ? NotesInlineMarkdownReplace(input) : input,
      value2: Dynamic = scanMarkdownCodeSpans(value),
      value3: Dynamic,
      index: Dynamic = 0;
    for (; index < value.length; ) {
      let value4: Dynamic = value2(index);
      (value3 === undefined || (value3 !== null && value3.index < index)) &&
        ((NotesInlineMarkdownPattern.lastIndex = index),
        (value3 = NotesInlineMarkdownPattern.exec(value)));
      if (value3 === null && value4 === undefined) {
        items.push({
          kind: "text",
          text: value.slice(index),
        });
        break;
      }
      if (
        value4 !== undefined &&
        (value3 === null || value4.start < value3.index)
      ) {
        value4.start > index &&
          items.push({
            kind: "text",
            text: value.slice(index, value4.start),
          });
        items.push({
          kind: "code",
          text: trimCodeSpanPadding(value, value4),
        });
        index = value4.end;
        continue;
      }
      let value5: Dynamic = value3;
      value5.index > index &&
        items.push({
          kind: "text",
          text: value.slice(index, value5.index),
        });
      value5[2] !== undefined
        ? items.push({
            kind: "bold",
            text: value5[2],
          })
        : value5[4] !== undefined
          ? items.push({
              kind: "italic",
              text: value5[4],
            })
          : value5[6] !== undefined &&
            value5[7] !== undefined &&
            (runtime.LinksNavigationHttpsPattern.test(value5[7]) &&
            (options?.linksTo === undefined ||
              options.linksTo.has(
                value === input
                  ? value5[7]
                  : NotesInlineMarkdownReplace_2(value5[7]),
              ))
              ? items.push({
                  kind: "link",
                  text: value5[6],
                  href: value5[7],
                })
              : items.push({
                  kind: "text",
                  text:
                    options?.literalUnsafeLinks === true
                      ? value5[0]
                      : value5[6],
                }));
      index = value5.index + value5[0].length;
    }
    let items2: Dynamic = [];
    for (let value4 of items as Dynamic) {
      let value5: Dynamic = items2[items2.length - 1];
      value4.kind === "text" && value5?.kind === "text"
        ? (value5.text += value4.text)
        : items2.push(value4);
    }
    if (value !== input)
      for (let value4 of items2 as Dynamic) {
        value4.text = NotesInlineMarkdownReplace_2(
          value4.text,
          value4.kind === "code",
        );
        value4.kind === "link" &&
          (value4.href = NotesInlineMarkdownReplace_2(value4.href));
      }
    return items2;
  }
  bindRuntimeValue(
    runtime,
    "jsxNotesInlineMarkdown",
    () => jsxNotesInlineMarkdown,
    (value) => {
      jsxNotesInlineMarkdown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesInlineMarkdownPattern",
    () => NotesInlineMarkdownPattern,
    (value) => {
      NotesInlineMarkdownPattern = value;
    },
  );
  bindRuntimeValue(runtime, "trimCodeSpanPadding", () => trimCodeSpanPadding);
  bindRuntimeValue(
    runtime,
    "scanMarkdownCodeSpans",
    () => scanMarkdownCodeSpans,
  );
  bindRuntimeValue(
    runtime,
    "Value_4",
    () => Value_4,
    (value) => {
      Value_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesInlineMarkdownUFDDUFDDPattern",
    () => NotesInlineMarkdownUFDDUFDDPattern,
    (value) => {
      NotesInlineMarkdownUFDDUFDDPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesInlineMarkdownReplace",
    () => NotesInlineMarkdownReplace,
    (value) => {
      NotesInlineMarkdownReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesInlineMarkdownReplace_2",
    () => NotesInlineMarkdownReplace_2,
    (value) => {
      NotesInlineMarkdownReplace_2 = value;
    },
  );
  bindRuntimeValue(runtime, "escapeMarkdownInline", () => escapeMarkdownInline);
  bindRuntimeValue(
    runtime,
    "parseNoteInlineMarkdown",
    () => parseNoteInlineMarkdown,
  );
  return () => {
    jsxNotesInlineMarkdown = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    NotesInlineMarkdownPattern =
      /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]\[]+)\]\(([^)\s\[]+)\))/g;
    Value_4 = "*`[]\\";
    NotesInlineMarkdownUFDDUFDDPattern = /[\uFDD0-\uFDD4]/g;
    NotesInlineMarkdownReplace = (input?: Dynamic): Dynamic =>
      input
        .replace(NotesInlineMarkdownUFDDUFDDPattern, "")
        .replace(
          /\\([*\u0060[\]\\])/g,
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            String.fromCharCode(64976 + Value_4.indexOf(options)),
        );
    NotesInlineMarkdownReplace_2 = (
      input?: Dynamic,
      options: Dynamic = false,
    ): Dynamic =>
      input.replace(
        NotesInlineMarkdownUFDDUFDDPattern,
        (input2?: Dynamic): Dynamic =>
          (options ? "\\" : "") + (Value_4[input2.charCodeAt(0) - 64976] ?? ""),
      );
  };
}
