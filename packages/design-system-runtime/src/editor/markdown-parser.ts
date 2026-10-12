import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorMarkdownParser(
  runtime: RuntimeBindings,
): () => void {
  var MAX_PARSED_MARKDOWN_BLOCKS: number;
  var MARKDOWN_IMAGE_LINE_PATTERN: RegExp;
  var MARKDOWN_ORDERED_LIST_PATTERN: RegExp;
  function parseMarkdownBlocks(markdown: string): Core.MarkdownParseResult {
    let blocks: Core.MarkdownBlock[] = [],
      sources: Core.MarkdownBlockSource[] = [],
      lines = markdown.split(`
`),
      sourceCursor = 0,
      appendBlock = (
        input: Core.MarkdownBlock,
        options: number,
        context: number,
        value = "",
      ): boolean => {
        if (blocks.length >= MAX_PARSED_MARKDOWN_BLOCKS) {
          return false;
        }
        blocks.push((0, runtime.normalizeMarkdownBlock)(input));
        sources.push({
          text:
            lines.slice(options, context).join(`
`) + value,
          lead: lines
            .slice(sourceCursor, options)
            .map(
              (input2: string): string =>
                input2 +
                `
`,
            )
            .join(""),
        });
        sourceCursor = context;
        return true;
      },
      lineIndex = 0,
      paragraphLines: string[] = [],
      paragraphStart = 0,
      flushParagraph = (): void => {
        if (paragraphLines.length > 0) {
          appendBlock(
            {
              type: "p",
              text: paragraphLines.join(" "),
            },
            paragraphStart,
            lineIndex,
          );
          paragraphLines = [];
        }
      };
    while (
      lineIndex < lines.length &&
      blocks.length < MAX_PARSED_MARKDOWN_BLOCKS
    ) {
      let value = (lines[lineIndex] ?? "").trim();
      if (value === "") {
        flushParagraph();
        lineIndex += 1;
        continue;
      }
      if (
        value.startsWith("```") &&
        !value.replace(/^\u0060+/, "").includes("`")
      ) {
        flushParagraph();
        let value3 = lineIndex,
          length = (/^\u0060+/.exec(value)?.[0] ?? "```").length,
          value4 = "`".repeat(length),
          items: string[] = [],
          flag: boolean = false;
        lineIndex += 1;
        while (lineIndex < lines.length) {
          let value6 = lines[lineIndex] ?? "";
          if (value6.trim().startsWith(value4)) {
            flag = true;
            lineIndex += 1;
            break;
          }
          items.push(value6);
          lineIndex += 1;
        }
        let value5 = lineIndex;
        if (!flag) {
          while (
            value5 > value3 + 1 &&
            (lines[value5 - 1] ?? "").trim() === ""
          ) {
            value5 -= 1;
          }
        }
        appendBlock(
          {
            type: "code",
            text: items.join(`
`),
          },
          value3,
          value5,
          flag
            ? ""
            : `
` + value4,
        );
        continue;
      }
      if (value.startsWith("#")) {
        flushParagraph();
        let value3 = /^(#{1,6})\s+([\s\S]*)$/.exec(value);
        if (value3 && value3[1] !== undefined && value3[2] !== undefined) {
          let length = value3[1].length;
          appendBlock(
            {
              type: length === 1 ? "h1" : length === 2 ? "h2" : "h3",
              text: value3[2],
            },
            lineIndex,
            lineIndex + 1,
          );
        } else {
          appendBlock(
            {
              type: "p",
              text: value,
            },
            lineIndex,
            lineIndex + 1,
          );
        }
        lineIndex += 1;
        continue;
      }
      if (/^(---+|\*\*\*+|___+)$/.test(value)) {
        flushParagraph();
        appendBlock(
          {
            type: "divider",
          },
          lineIndex,
          lineIndex + 1,
        );
        lineIndex += 1;
        continue;
      }
      if (value.startsWith(">")) {
        flushParagraph();
        let value3 = lineIndex,
          items = [];
        while (lineIndex < lines.length) {
          let value4 = (lines[lineIndex] ?? "").trim();
          if (!value4.startsWith(">")) {
            break;
          }
          items.push(value4.replace(/^>\s?/, ""));
          lineIndex += 1;
        }
        appendBlock(
          {
            type: "quote",
            text: items.join(" "),
          },
          value3,
          lineIndex,
        );
        continue;
      }
      if (
        /^[-*+]\s+/.test(value) ||
        MARKDOWN_ORDERED_LIST_PATTERN.test(value)
      ) {
        flushParagraph();
        let value3 = MARKDOWN_ORDERED_LIST_PATTERN.test(value),
          value4 = lineIndex,
          items = [];
        while (lineIndex < lines.length) {
          let value5 = (lines[lineIndex] ?? "").trim();
          if (
            !(value3
              ? MARKDOWN_ORDERED_LIST_PATTERN.test(value5)
              : /^[-*+]\s+/.test(value5))
          ) {
            break;
          }
          items.push(
            value5.replace(
              value3 ? MARKDOWN_ORDERED_LIST_PATTERN : /^[-*+]\s+/,
              "",
            ),
          );
          lineIndex += 1;
        }
        appendBlock(
          {
            type: value3 ? "ol" : "ul",
            items: items,
          },
          value4,
          lineIndex,
        );
        continue;
      }
      let value2 = MARKDOWN_IMAGE_LINE_PATTERN.exec(value);
      if (value2 && value2[2] !== undefined) {
        flushParagraph();
        appendBlock(
          {
            type: "img",
            src: value2[2],
            alt: value2[1] ?? "",
            size: "m",
          },
          lineIndex,
          lineIndex + 1,
        );
        lineIndex += 1;
        continue;
      }
      if (value.startsWith("|") && value.endsWith("|") && value.length > 1) {
        flushParagraph();
        let value3 = lineIndex,
          items: string[][] = [],
          flag: boolean = false,
          index = 0;
        while (lineIndex < lines.length) {
          let value4 = (lines[lineIndex] ?? "").trim();
          if (
            !(
              value4.startsWith("|") &&
              value4.endsWith("|") &&
              value4.length > 1
            )
          ) {
            break;
          }
          let value5 = value4
            .slice(1, -1)
            .split(/(?<!\\)\|/)
            .map((input: string) => input.trim());
          if (
            index === 1 &&
            value5.every((input: string) => /^:?-{2,}:?$/.test(input))
          ) {
            flag = true;
          } else {
            items.push(
              value5.map((input: string) =>
                input.replace(/\\\|/g, "|").replace(/^\\(?=:?-{2,}:?$)/, ""),
              ),
            );
          }
          index += 1;
          lineIndex += 1;
        }
        appendBlock(
          {
            type: "table",
            header: flag,
            rows: items,
          },
          value3,
          lineIndex,
        );
        continue;
      }
      if (paragraphLines.length === 0) {
        paragraphStart = lineIndex;
      }
      paragraphLines.push(value);
      lineIndex += 1;
    }
    flushParagraph();
    return {
      blocks: blocks,
      sources: sources,
    };
  }
  bindRuntimeValue(
    runtime,
    "MAX_PARSED_MARKDOWN_BLOCKS",
    () => MAX_PARSED_MARKDOWN_BLOCKS,
    (value) => {
      MAX_PARSED_MARKDOWN_BLOCKS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_IMAGE_LINE_PATTERN",
    () => MARKDOWN_IMAGE_LINE_PATTERN,
    (value) => {
      MARKDOWN_IMAGE_LINE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_ORDERED_LIST_PATTERN",
    () => MARKDOWN_ORDERED_LIST_PATTERN,
    (value) => {
      MARKDOWN_ORDERED_LIST_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "parseMarkdownBlocks", () => parseMarkdownBlocks);
  return () => {
    MAX_PARSED_MARKDOWN_BLOCKS = 1000;
    MARKDOWN_IMAGE_LINE_PATTERN = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
    MARKDOWN_ORDERED_LIST_PATTERN = /^\d{1,4}[.)]\s+/;
  };
}
