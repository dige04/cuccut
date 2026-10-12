import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorInlineMarkdown(
  runtime: RuntimeBindings,
): () => void {
  var jsxInlineMarkdown: typeof import("react/jsx-runtime");
  var INLINE_MARKDOWN_PATTERN: RegExp;
  var MARKDOWN_ESCAPABLE_CHARACTERS: string;
  var MARKDOWN_ESCAPE_SENTINEL_PATTERN: RegExp;
  var encodeMarkdownEscapes: (markdown: string) => string;
  var decodeMarkdownEscapes: (
    markdown: string,
    preserveBackslashes?: boolean,
  ) => string;
  var renderInlineCode: (key: number, text: string) => React.ReactElement;
  function codeSpanText(markdown: string, span: Core.MarkdownCodeSpan): string {
    if (
      span.to - span.from > 2 &&
      markdown.charCodeAt(span.from) === 32 &&
      markdown.charCodeAt(span.to - 1) === 32
    ) {
      let from = span.from;
      while (from < span.to && markdown.charCodeAt(from) === 32) {
        from++;
      }
      let value: number = span.to - 1;
      while (value > from && markdown.charCodeAt(value) === 32) {
        value--;
      }
      if (
        from < span.to &&
        (markdown.charCodeAt(from) === 96 || markdown.charCodeAt(value) === 96)
      ) {
        return markdown.slice(span.from + 1, span.to - 1);
      }
    }
    return markdown.slice(span.from, span.to);
  }
  function createCodeSpanScanner(
    markdown: string,
  ): (offset: number) => Core.MarkdownCodeSpan | undefined {
    let delimiterOffsets: number[] = [],
      delimiterLengths: number[] = [];
    for (let index = 0; index < markdown.length; ) {
      if (markdown.charCodeAt(index) !== 96) {
        index++;
        continue;
      }
      let value = index;
      while (value < markdown.length && markdown.charCodeAt(value) === 96) {
        value++;
      }
      delimiterOffsets.push(index);
      delimiterLengths.push(value - index);
      index = value;
    }
    let matchingDelimiterIndices: number[] = Array(
        delimiterOffsets.length,
      ).fill(-1),
      lastDelimiterByLength = new Map<number, number>();
    for (let value: number = delimiterOffsets.length - 1; value >= 0; value--) {
      matchingDelimiterIndices[value] =
        lastDelimiterByLength.get(delimiterLengths[value]) ?? -1;
      lastDelimiterByLength.set(delimiterLengths[value], value);
    }
    let cursor: number = 0;
    return (input: number) => {
      for (; cursor < delimiterOffsets.length; cursor++) {
        let value = delimiterOffsets[cursor];
        if (value < input) {
          continue;
        }
        let value2 = matchingDelimiterIndices[cursor];
        if (value2 < 0) {
          continue;
        }
        let value3 = delimiterLengths[cursor];
        return {
          start: value,
          end: delimiterOffsets[value2] + value3,
          from: value + value3,
          to: delimiterOffsets[value2],
        };
      }
      return;
    };
  }
  function tokenizeInlineMarkdown(
    markdown: string,
    options?: Core.InlineMarkdownOptions,
  ) {
    let tokens: Core.InlineMarkdownToken[] = [],
      escapedMarkdown =
        options?.escapes === true ? encodeMarkdownEscapes(markdown) : markdown,
      nextCodeSpan = createCodeSpanScanner(escapedMarkdown),
      inlineMatch: RegExpExecArray | null | undefined,
      offset = 0;
    while (offset < escapedMarkdown.length) {
      let value = nextCodeSpan(offset);
      if (
        inlineMatch === undefined ||
        (inlineMatch !== null && inlineMatch.index < offset)
      ) {
        INLINE_MARKDOWN_PATTERN.lastIndex = offset;
        inlineMatch = INLINE_MARKDOWN_PATTERN.exec(escapedMarkdown);
      }
      if (inlineMatch === null && value === undefined) {
        tokens.push({
          kind: "text",
          text: escapedMarkdown.slice(offset),
        });
        break;
      }
      if (
        value !== undefined &&
        (inlineMatch === null || value.start < inlineMatch.index)
      ) {
        if (value.start > offset) {
          tokens.push({
            kind: "text",
            text: escapedMarkdown.slice(offset, value.start),
          });
        }
        tokens.push({
          kind: "code",
          text: codeSpanText(escapedMarkdown, value),
        });
        offset = value.end;
        continue;
      }
      let value2 = inlineMatch as RegExpExecArray;
      if (value2.index > offset) {
        tokens.push({
          kind: "text",
          text: escapedMarkdown.slice(offset, value2.index),
        });
      }
      if (value2[2] !== undefined) {
        tokens.push({
          kind: "bold",
          text: value2[2],
        });
      } else if (value2[4] !== undefined) {
        tokens.push({
          kind: "italic",
          text: value2[4],
        });
      } else if (value2[6] !== undefined && value2[7] !== undefined) {
        if (
          runtime.EXTERNAL_LINK_PATTERN.test(value2[7]) &&
          (options?.linksTo === undefined ||
            options.linksTo.has(
              escapedMarkdown === markdown
                ? value2[7]
                : decodeMarkdownEscapes(value2[7]),
            ))
        ) {
          tokens.push({
            kind: "link",
            text: value2[6],
            href: value2[7],
          });
        } else {
          tokens.push({
            kind: "text",
            text: options?.literalUnsafeLinks === true ? value2[0] : value2[6],
          });
        }
      }
      offset = value2.index + value2[0].length;
    }
    let mergedTokens: Core.InlineMarkdownToken[] = [];
    for (let value of tokens) {
      let value2 = mergedTokens[mergedTokens.length - 1];
      if (value.kind === "text" && value2?.kind === "text") {
        value2.text += value.text;
      } else {
        mergedTokens.push(value);
      }
    }
    if (escapedMarkdown !== markdown) {
      for (let value of mergedTokens) {
        if (
          ((value.text = decodeMarkdownEscapes(
            value.text,
            value.kind === "code",
          )),
          value.kind === "link")
        ) {
          value.href = decodeMarkdownEscapes(value.href);
        }
      }
    }
    return mergedTokens;
  }
  function tokenizeCodeSpans(markdown: string): Core.InlineMarkdownToken[] {
    let tokens: Core.InlineMarkdownToken[] = [],
      nextCodeSpan = createCodeSpanScanner(markdown),
      offset = 0;
    for (
      let value = nextCodeSpan(offset);
      value !== undefined;
      value = nextCodeSpan(offset)
    ) {
      if (value.start > offset) {
        tokens.push({
          kind: "text",
          text: markdown.slice(offset, value.start),
        });
      }
      tokens.push({
        kind: "code",
        text: codeSpanText(markdown, value),
      });
      offset = value.end;
    }
    if (offset < markdown.length) {
      tokens.push({
        kind: "text",
        text: markdown.slice(offset),
      });
    }
    return tokens;
  }
  function renderCodeSpans(markdown: string): React.ReactNode {
    if (!markdown.includes("`")) {
      return markdown;
    }
    return tokenizeCodeSpans(markdown).map(
      (source: Core.InlineMarkdownToken, options: number) =>
        source.kind === "code"
          ? renderInlineCode(options, source.text)
          : source.text,
    );
  }
  function renderInlineMarkdown(
    markdown: string,
    options?: Core.InlineMarkdownOptions,
  ) {
    let value: boolean = options?.escapes === true,
      value2 = tokenizeInlineMarkdown(markdown, {
        escapes: value,
        literalUnsafeLinks: options?.literalUnsafeLinks === true,
        linksTo: options?.linksTo,
      });
    if (value2.length === 1 && value2[0]?.kind === "text") {
      return value2[0].text;
    }
    return value2.map((source: Core.InlineMarkdownToken, options2: number) => {
      switch (source.kind) {
        case "bold":
          return (() => {
            const _Element = "strong";
            const _elementProps = {
              children: value ? source.text : renderCodeSpans(source.text),
            };
            const _elementKey = options2;
            return <_Element key={_elementKey} {..._elementProps} />;
          })();
        case "italic":
          return (() => {
            const _Element2 = "em";
            const _elementProps2 = {
              children: value ? source.text : renderCodeSpans(source.text),
            };
            const _elementKey2 = options2;
            return <_Element2 key={_elementKey2} {..._elementProps2} />;
          })();
        case "code":
          return renderInlineCode(options2, source.text);
        case "link": {
          let value3 = options?.links ?? "live";
          if (
            value3 === "live" &&
            (0, runtime.classifyExternalLink)(source.href) === null
          ) {
            return source.text;
          }
          let value4 = options?.linkTabIndex;
          return (() => {
            const _Element3 = "a";
            const _elementProps3 = {
              ...(0, runtime.externalLinkProps)(source.href, value3),
              ...(value4 === undefined
                ? {}
                : {
                    tabIndex: value4,
                  }),
              children: source.text,
            };
            const _elementKey3 = options2;
            return <_Element3 key={_elementKey3} {..._elementProps3} />;
          })();
        }
        default:
          return source.text;
      }
    });
  }
  bindRuntimeValue(
    runtime,
    "jsxInlineMarkdown",
    () => jsxInlineMarkdown,
    (value) => {
      jsxInlineMarkdown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INLINE_MARKDOWN_PATTERN",
    () => INLINE_MARKDOWN_PATTERN,
    (value) => {
      INLINE_MARKDOWN_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "codeSpanText", () => codeSpanText);
  bindRuntimeValue(
    runtime,
    "createCodeSpanScanner",
    () => createCodeSpanScanner,
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_ESCAPABLE_CHARACTERS",
    () => MARKDOWN_ESCAPABLE_CHARACTERS,
    (value) => {
      MARKDOWN_ESCAPABLE_CHARACTERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_ESCAPE_SENTINEL_PATTERN",
    () => MARKDOWN_ESCAPE_SENTINEL_PATTERN,
    (value) => {
      MARKDOWN_ESCAPE_SENTINEL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeMarkdownEscapes",
    () => encodeMarkdownEscapes,
    (value) => {
      encodeMarkdownEscapes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeMarkdownEscapes",
    () => decodeMarkdownEscapes,
    (value) => {
      decodeMarkdownEscapes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tokenizeInlineMarkdown",
    () => tokenizeInlineMarkdown,
  );
  bindRuntimeValue(runtime, "tokenizeCodeSpans", () => tokenizeCodeSpans);
  bindRuntimeValue(
    runtime,
    "renderInlineCode",
    () => renderInlineCode,
    (value) => {
      renderInlineCode = value;
    },
  );
  bindRuntimeValue(runtime, "renderCodeSpans", () => renderCodeSpans);
  bindRuntimeValue(runtime, "renderInlineMarkdown", () => renderInlineMarkdown);
  return () => {
    jsxInlineMarkdown = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    INLINE_MARKDOWN_PATTERN =
      /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]\[]+)\]\(([^)\s\[]+)\))/g;
    MARKDOWN_ESCAPABLE_CHARACTERS = "*`[]\\";
    MARKDOWN_ESCAPE_SENTINEL_PATTERN = /[\uFDD0-\uFDD4]/g;
    encodeMarkdownEscapes = (markdown: string) =>
      markdown
        .replace(MARKDOWN_ESCAPE_SENTINEL_PATTERN, "")
        .replace(/\\([*\u0060[\]\\])/g, (input: string, options: string) =>
          String.fromCharCode(
            64976 + MARKDOWN_ESCAPABLE_CHARACTERS.indexOf(options),
          ),
        );
    decodeMarkdownEscapes = (markdown: string, preserveBackslashes = false) =>
      markdown.replace(
        MARKDOWN_ESCAPE_SENTINEL_PATTERN,
        (input: string): string =>
          (preserveBackslashes ? "\\" : "") +
          (MARKDOWN_ESCAPABLE_CHARACTERS[input.charCodeAt(0) - 64976] ?? ""),
      );
    renderInlineCode = (key: number, text: string) =>
      (() => {
        const _Element4 = "code";
        const _elementProps4 = {
          className: "rounded bg-bg-warm px-1 font-mono text-[0.9em]",
          children: text,
        };
        const _elementKey4 = key;
        return <_Element4 key={_elementKey4} {..._elementProps4} />;
      })();
  };
}
