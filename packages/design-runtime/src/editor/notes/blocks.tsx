/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorNotesBlocks(runtime: RuntimeBindings): () => void {
  var jsxNotesBlocks: Dynamic;
  var NotesBlocksPattern: Dynamic;
  var NotesBlocksPattern_2: Dynamic;
  var NotesBlocksPattern_3: Dynamic;
  var NotesBlocksReplace: Dynamic;
  var NotesBlocksReplace_2: Dynamic;
  var NotesBlocksEscapesLiteralUnsafeLinksConfig: Dynamic;
  var NotesBlocksHandler: Dynamic;
  var NotesBlocksMap: Dynamic;
  function parseNoteBlocks(input?: Dynamic, options?: Dynamic): Dynamic {
    let items: Dynamic = [],
      value: Dynamic = options?.lists !== false;
    for (let value2 of input
      .replace(/\u00a0/g, " ")
      .replace(/[\uFDD0-\uFDD4]/g, "")
      .replace(/\n$/, "").split(`
`) as Dynamic) {
      let value3: Dynamic = items[items.length - 1],
        value4: Dynamic = value ? NotesBlocksPattern.exec(value2) : null,
        value5: Dynamic =
          value4 || !value ? null : NotesBlocksPattern_2.exec(value2);
      value4
        ? value3?.kind === "ul"
          ? value3.items.push(value4[1] ?? "")
          : items.push({
              kind: "ul",
              items: [value4[1] ?? ""],
            })
        : value5
          ? value3?.kind === "ol"
            ? value3.items.push(value5[2] ?? "")
            : items.push({
                kind: "ol",
                start: Number(value5[1]),
                items: [value5[2] ?? ""],
              })
          : items.push({
              kind: "p",
              text: value
                ? value2.replace(NotesBlocksPattern_3, "$1$2")
                : value2,
            });
    }
    return items;
  }
  function serializeNoteBlocks(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of input as Dynamic)
      if (value.kind === "p") items.push(NotesBlocksReplace(value.text));
      else if (value.kind === "ul")
        for (let value2 of value.items as Dynamic) items.push("- " + value2);
      else
        value.items.forEach(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            items.push(
              String(Math.min(value.start + options, 999)) + ". " + input2,
            ),
        );
    return items.join(`
`);
  }
  function renderNoteInlineMarkdown(input?: Dynamic): Dynamic {
    return NotesBlocksHandler(input).map(
      (source?: Dynamic, options?: Dynamic): Dynamic =>
        source.kind === "bold" ? (
          <strong key={options}>{source.text}</strong>
        ) : source.kind === "italic" ? (
          <em key={options}>{source.text}</em>
        ) : source.kind === "code" ? (
          <code key={options}>{source.text}</code>
        ) : source.kind === "link" ? (
          <a key={options} data-href={source.href} title={source.href}>
            {source.text}
          </a>
        ) : (
          source.text
        ),
    );
  }
  function noteRichTextCost(input?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (let value of parseNoteBlocks(input) as Dynamic)
      for (let value2 of (value.kind === "p"
        ? [value.text]
        : value.items) as Dynamic)
        index +=
          1 +
          NotesBlocksHandler(value2).filter(
            (source?: Dynamic): Dynamic => source.kind !== "text",
          ).length;
    return index;
  }
  function renderNoteMarkdown(input?: Dynamic): Dynamic {
    return parseNoteBlocks(input).map(
      (source?: Dynamic, options?: Dynamic): Dynamic =>
        source.kind === "p" ? (
          <div key={options}>
            {source.text === "" ? (
              <br />
            ) : (
              renderNoteInlineMarkdown(source.text)
            )}
          </div>
        ) : source.kind === "ul" ? (
          <ul key={options}>{NotesBlocksMap(source.items)}</ul>
        ) : (
          <ol key={options} start={source.start}>
            {NotesBlocksMap(source.items)}
          </ol>
        ),
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxNotesBlocks",
    () => jsxNotesBlocks,
    (value) => {
      jsxNotesBlocks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesBlocksPattern",
    () => NotesBlocksPattern,
    (value) => {
      NotesBlocksPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesBlocksPattern_2",
    () => NotesBlocksPattern_2,
    (value) => {
      NotesBlocksPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesBlocksPattern_3",
    () => NotesBlocksPattern_3,
    (value) => {
      NotesBlocksPattern_3 = value;
    },
  );
  bindRuntimeValue(runtime, "parseNoteBlocks", () => parseNoteBlocks);
  bindRuntimeValue(
    runtime,
    "NotesBlocksReplace",
    () => NotesBlocksReplace,
    (value) => {
      NotesBlocksReplace = value;
    },
  );
  bindRuntimeValue(runtime, "serializeNoteBlocks", () => serializeNoteBlocks);
  bindRuntimeValue(
    runtime,
    "NotesBlocksReplace_2",
    () => NotesBlocksReplace_2,
    (value) => {
      NotesBlocksReplace_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesBlocksEscapesLiteralUnsafeLinksConfig",
    () => NotesBlocksEscapesLiteralUnsafeLinksConfig,
    (value) => {
      NotesBlocksEscapesLiteralUnsafeLinksConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesBlocksHandler",
    () => NotesBlocksHandler,
    (value) => {
      NotesBlocksHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "renderNoteInlineMarkdown",
    () => renderNoteInlineMarkdown,
  );
  bindRuntimeValue(
    runtime,
    "NotesBlocksMap",
    () => NotesBlocksMap,
    (value) => {
      NotesBlocksMap = value;
    },
  );
  bindRuntimeValue(runtime, "noteRichTextCost", () => noteRichTextCost);
  bindRuntimeValue(runtime, "renderNoteMarkdown", () => renderNoteMarkdown);
  return () => {
    jsxNotesBlocks = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    NotesBlocksPattern = /^ *[-•*] (.*)$/;
    NotesBlocksPattern_2 = /^ *(\d{1,3})\. (.*)$/;
    NotesBlocksPattern_3 = /^( *(?:\d{1,3})?)\\([-•.](?= ))/;
    NotesBlocksReplace = (input?: Dynamic): Dynamic =>
      input
        .replace(/^( *)([-•])(?= )/, "$1\\$2")
        .replace(/^( *\d{1,3})\.(?= )/, "$1\\.");
    NotesBlocksReplace_2 = (input?: Dynamic): Dynamic =>
      serializeNoteBlocks(parseNoteBlocks(input))
        .replace(/(?:\n(?:- |\d{1,3}\. )?)+$/, "")
        .replace(/^(?:- |\d{1,3}\. )$/, "");
    NotesBlocksEscapesLiteralUnsafeLinksConfig = {
      escapes: true,
      literalUnsafeLinks: true,
    };
    NotesBlocksHandler = (input?: Dynamic, options?: Dynamic): Dynamic =>
      (0, runtime.parseNoteInlineMarkdown)(
        input,
        options
          ? {
              ...NotesBlocksEscapesLiteralUnsafeLinksConfig,
              linksTo: options,
            }
          : NotesBlocksEscapesLiteralUnsafeLinksConfig,
      );
    NotesBlocksMap = (input?: Dynamic): Dynamic =>
      input.map(
        (input2?: Dynamic, options?: Dynamic): Dynamic => (
          <li key={options}>
            {input2 === "" ? <br /> : renderNoteInlineMarkdown(input2)}
          </li>
        ),
      );
  };
}
