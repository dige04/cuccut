import type { StatementFailure, StatementLocation } from "./types";
interface ControlRule {
  kws: string[];
  re: RegExp;
}
interface PendingStatement {
  code: string;
  start: number;
  end: number;
  chain: boolean;
}
import type { SplitStatementsResult, DetailedStatement } from "./types";
/** Streaming JavaScript statement splitter. Source byte range: 5377–10516. */
import type { StatementStream, StatementStreamOptions } from "./types";
var BLOCK_COMMENT: string = String.raw`\/\*(?:[^*]|\*(?!\/))*\*\/`;
var TRAILING_COMMENTS: RegExp = new RegExp(
  String.raw`(?:\s|${BLOCK_COMMENT}|\/\/[^\n]*(?:\n|$))+$`,
);
var CONTROL_STATEMENT: RegExp = new RegExp(
  String.raw`^(?:\s|${BLOCK_COMMENT}|\/\/[^\n]*\n)*(if|try|do)\b`,
);
function hasUnfilledControlBody(code: string): boolean {
  let tail = code.slice(code.lastIndexOf("}") + 1);
  let controlHeader = /(?<![.\w$])(if|for|while|catch|switch|with)\s*\(/g;
  for (
    let match = controlHeader.exec(tail);
    match;
    match = controlHeader.exec(tail)
  ) {
    if (
      match[1] === "while" &&
      (CONTROL_STATEMENT.exec(code) || [])[1] === "do"
    )
      continue;
    let depth = 0;
    let index = match.index + match[0].length - 1;
    for (; index < tail.length; index++) {
      let character = tail[index];
      if (character === "(") depth++;
      else if (character === ")" && --depth === 0) break;
    }
    if (depth === 0 && index < tail.length && !tail.slice(index + 1).trim())
      return true;
  }
  return false;
}
var CONTROL_CONTINUATIONS: Record<string, ControlRule> = {
  if: {
    kws: ["else"],
    re: /^else\b/,
  },
  try: {
    kws: ["catch", "finally"],
    re: /^(catch|finally)\b/,
  },
  do: {
    kws: ["while"],
    re: /^while\b/,
  },
};
var REGEX_PREFIX_KEYWORDS: RegExp =
  /(?:^|[^\w$.])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)\s*$/;
var isWhitespace: (input: string) => boolean = (input) =>
  input === " " ||
  input === "\t" ||
  input === "\r" ||
  input ===
    `
`;
function createStatementStream(
  options?: StatementStreamOptions,
): StatementStream;
function createStatementStream(
  options?: StatementStreamOptions,
): StatementStream {
  let settings: StatementStreamOptions = options || {};
  let joinChains = !!settings.joinChains;
  let regexAfterKeywords = settings.regexAfterKeywords !== false;
  let buffer: string;
  let parenDepth: number;
  let braceDepth: number;
  let bracketDepth: number;
  let quote: string | null;
  let escapedString: boolean;
  let lineComment: boolean;
  let statementStart: number;
  let templateDepths: number[];
  let templateDollar: boolean;
  let blockComment: boolean;
  let regex: boolean;
  let regexCharacterClass: boolean;
  let escapedRegex: boolean;
  let pendingSlash: boolean;
  let lastSignificantChar: string;
  let arrowBodyPending: boolean;
  let controlEnd: number;
  let continuationStart: number;
  let lineCommentStart: number;
  let continuationRule: ControlRule | null;
  let statementCount: number;
  let ended: boolean;
  let pendingChain: PendingStatement | null;
  let bufferOffset: number;
  function reset(): void {
    buffer = "";
    parenDepth = braceDepth = bracketDepth = 0;
    quote = null;
    escapedString = false;
    lineComment = false;
    statementStart = 0;
    templateDepths = [];
    templateDollar = false;
    blockComment = false;
    regex = regexCharacterClass = escapedRegex = false;
    pendingSlash = false;
    lastSignificantChar = "";
    arrowBodyPending = false;
    controlEnd = -1;
    continuationStart = 0;
    lineCommentStart = 0;
    continuationRule = null;
    statementCount = 0;
    ended = false;
    pendingChain = null;
    bufferOffset = 0;
  }
  reset();
  let atTopLevel = () =>
    parenDepth === 0 && braceDepth === 0 && bracketDepth === 0;
  function emitStatement(
    input: string,
    options2: boolean,
    context: number,
    value2: number,
  ): void {
    let value3 = statementCount++;
    if (settings.onStatement)
      try {
        settings.onStatement(input, value3, {
          chain: options2,
          start: context,
          end: value2,
        });
      } catch (value4: unknown) {
        if (settings.onError) settings.onError(value4);
        else throw value4;
      }
  }
  function queueStatement(
    input: string,
    options2: number,
    context: number,
  ): void {
    let value2 = input.length - input.trimStart().length;
    let value3 = input.trim();
    let value4 = value3[0] === ".";
    let value5 = bufferOffset + options2 + value2;
    let value6 = value5 + value3.length;
    if (!joinChains) {
      emitStatement(value3, value4, value5, value6);
      return;
    }
    if (value4 && pendingChain) {
      pendingChain.code +=
        `
` + value3;
      pendingChain.end = value6;
      return;
    }
    if (pendingChain)
      emitStatement(
        pendingChain.code,
        false,
        pendingChain.start,
        pendingChain.end,
      );
    pendingChain = {
      code: value3,
      start: value5,
      end: value6,
      chain: value4,
    };
  }
  function flushChain(): void {
    if (pendingChain) {
      let value2 = pendingChain;
      pendingChain = null;
      emitStatement(value2.code, value2.chain, value2.start, value2.end);
    }
  }
  function flushControlStatement(): void {
    let value2 = statementStart;
    let slice = buffer.slice(statementStart, controlEnd);
    if (((statementStart = continuationStart), (controlEnd = -1), slice.trim()))
      queueStatement(slice, value2, value2 + slice.length);
  }
  function finishStatement(input: number): boolean {
    let value2 = statementStart;
    let slice = buffer.slice(statementStart, input);
    let value3 = slice.replace(TRAILING_COMMENTS, "");
    if (
      /(?<!\.)\b(else|try|do|finally)$/.test(value3) ||
      hasUnfilledControlBody(value3)
    )
      return false;
    let value4 = (CONTROL_STATEMENT.exec(slice) || [])[1];
    if (value4) {
      controlEnd = input;
      continuationStart = buffer.length;
      continuationRule = CONTROL_CONTINUATIONS[value4]!;
      return true;
    }
    if (((statementStart = buffer.length), !slice.trim())) return false;
    queueStatement(slice, value2, input);
    return true;
  }
  function checkControlContinuation(): void {
    if (controlEnd < 0) return;
    let value2 = continuationRule!;
    let value3 = buffer.slice(continuationStart).replace(/^\s+/, "");
    if (value3 === "/" || value2.kws.some((input) => input.startsWith(value3)))
      return;
    if (value2.re.test(value3)) {
      controlEnd = -1;
      return;
    }
    flushControlStatement();
  }
  function finishAtDelimiter(): void {
    if (controlEnd < 0) finishStatement(buffer.length - 1);
  }
  function acceptCharacter(input: string): void {
    if (pendingSlash) {
      if (((pendingSlash = false), input === "/")) {
        if (
          ((lineComment = true),
          (lineCommentStart = buffer.length - 2),
          atTopLevel() && controlEnd < 0)
        )
          finishStatement(lineCommentStart);
        return;
      }
      if (input === "*") {
        blockComment = true;
        return;
      }
      if (
        lastSignificantChar === "" ||
        "([{,;=!&|?:+-*%^~<>".indexOf(lastSignificantChar) >= 0 ||
        (regexAfterKeywords &&
          REGEX_PREFIX_KEYWORDS.test(
            buffer.slice(Math.max(0, buffer.length - 16), buffer.length - 2),
          ))
      )
        regex = true;
      else lastSignificantChar = "/";
    }
    if (blockComment) {
      if (input === "/" && buffer[buffer.length - 2] === "*") {
        if (((blockComment = false), controlEnd >= 0 && atTopLevel()))
          continuationStart = buffer.length;
      }
      return;
    }
    if (lineComment) {
      if (
        input ===
        `
`
      ) {
        if (((lineComment = false), atTopLevel())) {
          if (controlEnd >= 0) continuationStart = buffer.length;
          else if (statementStart >= lineCommentStart)
            statementStart = buffer.length;
        }
      }
      return;
    }
    if (quote !== null) {
      if (escapedString) {
        escapedString = input === "\\";
        templateDollar = false;
        return;
      }
      if (input === "\\") {
        escapedString = true;
        templateDollar = false;
        return;
      }
      if (quote === "`") {
        if (input === "{" && templateDollar) {
          templateDollar = false;
          templateDepths.push(braceDepth);
          braceDepth++;
          quote = null;
          return;
        }
        templateDollar = input === "$";
      }
      if (input === quote) {
        lastSignificantChar = input;
        quote = null;
      }
      return;
    }
    if (regex) {
      if (escapedRegex) {
        escapedRegex = false;
        return;
      }
      if (input === "\\") {
        escapedRegex = true;
        return;
      }
      if (regexCharacterClass) {
        if (input === "]") regexCharacterClass = false;
        return;
      }
      if (input === "[") {
        regexCharacterClass = true;
        return;
      }
      if (input === "/") {
        regex = false;
        lastSignificantChar = "/";
      }
      return;
    }
    if (arrowBodyPending && !isWhitespace(input)) arrowBodyPending = false;
    switch ((checkControlContinuation(), input)) {
      case "'":
      case '"':
      case "`":
        quote = input;
        lastSignificantChar = input;
        return;
      case "(":
        parenDepth++;
        lastSignificantChar = input;
        return;
      case ")":
        if (parenDepth > 0) parenDepth--;
        lastSignificantChar = input;
        return;
      case "{":
        braceDepth++;
        lastSignificantChar = input;
        return;
      case "}":
        if (braceDepth > 0) braceDepth--;
        if (
          templateDepths.length > 0 &&
          braceDepth === templateDepths[templateDepths.length - 1]
        ) {
          templateDepths.pop();
          quote = "`";
        }
        lastSignificantChar = input;
        return;
      case "[":
        bracketDepth++;
        lastSignificantChar = input;
        return;
      case "]":
        if (bracketDepth > 0) bracketDepth--;
        lastSignificantChar = input;
        return;
      case "/":
        pendingSlash = true;
        return;
      case ">":
        if (buffer[buffer.length - 2] === "=" && atTopLevel())
          arrowBodyPending = true;
        lastSignificantChar = input;
        return;
      case `
`:
        if (arrowBodyPending) return;
        if (atTopLevel()) finishAtDelimiter();
        return;
      case ";":
        if (atTopLevel()) finishAtDelimiter();
        lastSignificantChar = input;
        return;
      case " ":
      case "\t":
      case "\r":
        return;
      default:
        lastSignificantChar = input;
    }
  }
  function compactBuffer(): void {
    if (controlEnd >= 0 || statementStart < 4096) return;
    let value2 = Math.min(
      statementStart,
      lineCommentStart > statementStart || !lineComment
        ? statementStart
        : lineCommentStart,
    );
    if (value2 <= 0) return;
    buffer = buffer.slice(value2);
    bufferOffset += value2;
    statementStart -= value2;
    continuationStart = Math.max(0, continuationStart - value2);
    lineCommentStart = Math.max(0, lineCommentStart - value2);
  }
  function push(input: string): void {
    if (ended) {
      let value2 = Error(
        "stmtstream: push() after end(); call reset() to start a new program",
      ) as StatementFailure;
      if (((value2.code = "ENDED"), settings.onError)) settings.onError(value2);
      else throw value2;
      return;
    }
    input = String(input);
    for (let index = 0; index < input.length; index++) {
      buffer += input[index];
      acceptCharacter(input[index]!);
    }
    compactBuffer();
  }
  function describeOpenSyntax(): string {
    let items = [];
    if (quote)
      items.push(
        quote === "`" ? "a template literal" : "a string (" + quote + ")",
      );
    if (blockComment) items.push("a block comment");
    if (regex) items.push("a regular expression");
    if (parenDepth) items.push(parenDepth + " × (");
    if (bracketDepth) items.push(bracketDepth + " × [");
    if (braceDepth) items.push(braceDepth + " × {");
    return items.join(", ");
  }
  function value(): void {
    if (ended) return;
    ended = true;
    let value2 = quote !== null || blockComment || regex;
    if (!value2) {
      if (pendingSlash) {
        pendingSlash = false;
        lastSignificantChar = "/";
      }
      buffer += `
`;
      acceptCharacter(`
`);
    }
    if (controlEnd >= 0) flushControlStatement();
    let slice = buffer.slice(statementStart);
    let value3 = slice.replace(TRAILING_COMMENTS, "").trim();
    let value4 = false;
    if (value3) {
      let value5 = describeOpenSyntax();
      if (value5 || value2) value4 = true;
      else if (
        /(?<!\.)\b(else|try|do|finally)$/.test(value3) ||
        hasUnfilledControlBody(value3) ||
        arrowBodyPending
      )
        value4 = true;
      if (value4) {
        flushChain();
        let value6 = Error(
          "stmtstream: the program ends in the middle of a statement" +
            (value5
              ? " (still open: " + value5 + ")"
              : " (its body has not arrived)"),
        ) as StatementFailure;
        if (
          ((value6.code = "INCOMPLETE"),
          (value6.tail = slice.trim()),
          (value6.open = value5),
          settings.onError)
        )
          settings.onError(value6);
      } else {
        let value6 = statementStart;
        statementStart = buffer.length;
        queueStatement(slice, value6, value6 + slice.length);
      }
    }
    if ((flushChain(), settings.onDone))
      settings.onDone({
        statements: statementCount,
        incomplete: value4,
      });
  }
  return {
    push: push,
    end: value,
    reset: reset,
    tail: () => buffer.slice(statementStart),
    get count() {
      return statementCount;
    },
  };
}
function splitStatements(
  code: string,
  options: StatementStreamOptions & {
    detailed: true;
  },
): SplitStatementsResult<DetailedStatement>;
function splitStatements(
  code: string,
  options?: StatementStreamOptions & {
    detailed?: false;
  },
): SplitStatementsResult;
function splitStatements(
  code: string,
  options: StatementStreamOptions,
): SplitStatementsResult<string | DetailedStatement>;
function splitStatements(
  code: string,
  options?: StatementStreamOptions,
): SplitStatementsResult<string | DetailedStatement> {
  let statements: (string | DetailedStatement)[] = [];
  let settings: StatementStreamOptions = Object.assign({}, options);
  let incomplete: string | null = null;
  let stream = createStatementStream(
    Object.assign(settings, {
      onStatement: (
        input: string,
        options2: number,
        context: StatementLocation,
      ): number =>
        statements.push(
          settings.detailed
            ? Object.assign(
                {
                  code: input,
                  index: options2,
                },
                context,
              )
            : input,
        ),
      onError: (input: unknown) => {
        const error = input as StatementFailure;
        if (error.code === "INCOMPLETE") incomplete = error.tail!;
        else throw input;
      },
    }),
  );
  stream.push(code);
  stream.end();
  return {
    statements: statements,
    incomplete: incomplete,
  };
}
export { createStatementStream, splitStatements };
