import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorColorContrastPairs(
  runtime: RuntimeBindings,
): () => void {
  var COLOR_ROLE_WORDS: string[][];
  var COLOR_SURFACE_ROLE: number;
  var COLOR_TEXT_ROLE: number;
  var COLOR_BORDER_ROLE: number;
  var COLOR_ON_ROLE: number;
  var stripTokenNamespace: (name: string, namespace: string) => string;
  var CONTRAST_EXCLUDED_TOKEN_WORDS: Set<string>;
  var CONTRAST_HIGHLIGHT_WORDS: Set<string>;
  var CONTRAST_SURFACE_MODIFIER_WORDS: Set<string>;
  var CONTRAST_ON_VERB_WORDS: Set<string>;
  var CONTRAST_NEGATION_WORDS: Set<string>;
  var CONTRAST_TEXT_USAGE_PATTERN: RegExp;
  var CONTRAST_ON_WORD_PATTERN: RegExp;
  var CONTRAST_CLAUSE_BOUNDARY_PATTERN: RegExp;
  var CONTRAST_CLAUSE_BOUNDARIES_PATTERN: RegExp;
  var CONTRAST_TOKEN_JOIN_PATTERN: RegExp;
  var escapeContrastRegex: (input: string) => string;
  function colorTokenRole(name: string, namespace: string): number {
    let value = (
      (0, runtime.splitTokenName)(stripTokenNamespace(name, namespace))[0] ?? ""
    ).toLowerCase();
    return COLOR_ROLE_WORDS.findIndex((input) => input.includes(value));
  }
  function isContrastBackgroundToken(name: string, namespace: string): boolean {
    let value = colorTokenRole(name, namespace);
    return (
      value !== COLOR_TEXT_ROLE &&
      value !== COLOR_ON_ROLE &&
      value !== COLOR_BORDER_ROLE
    );
  }
  function isGeneralSurfaceToken(name: string, namespace: string): boolean {
    return (0, runtime.splitTokenName)(stripTokenNamespace(name, namespace))
      .slice(1)
      .every(
        (input: string) =>
          CONTRAST_SURFACE_MODIFIER_WORDS.has(input.toLowerCase()) ||
          colorTokenRole(input, "") === COLOR_SURFACE_ROLE,
      );
  }
  function contrastTokenMatchers(
    names: Iterable<string>,
    namespace: string,
  ): Editor.ContrastMatcher[] {
    let items: { name: string; key: string }[] = [];
    for (let value of names) {
      if (!isContrastBackgroundToken(value, namespace)) {
        continue;
      }
      items.push({
        name: value,
        key: value,
      });
      let value2 = stripTokenNamespace(value, namespace);
      if (value2 !== value) {
        items.push({
          name: value,
          key: value2,
        });
      }
    }
    items.sort((input, options) => options.key.length - input.key.length);
    return items.map(({ name: name, key: key }) => ({
      name: name,
      re: new RegExp(
        "(^|[^A-Za-z0-9_.-])`?" +
          escapeContrastRegex(key) +
          "`?(?=$|[^A-Za-z0-9_-])",
        "i",
      ),
    }));
  }
  function contrastBackgroundsInUsage(
    usage: string | undefined,
    name: string,
    matchers: Editor.ContrastMatcher[],
  ): string[] {
    if (
      usage === undefined ||
      usage === "" ||
      usage.search(CONTRAST_ON_WORD_PATTERN) < 0
    ) {
      return [];
    }
    let entries = new Map<string, number>();
    for (let value of usage.matchAll(CONTRAST_ON_WORD_PATTERN)) {
      let value2 = value.index ?? 0,
        value3 = (
          usage
            .slice(0, value2)
            .split(CONTRAST_CLAUSE_BOUNDARIES_PATTERN)
            .pop() ?? ""
        )
          .trimEnd()
          .split(/\s+/)
          .map((input) => input.toLowerCase().replace(/[^a-z'\u2019]/g, ""));
      if (
        value3.some((input) => CONTRAST_NEGATION_WORDS.has(input)) ||
        CONTRAST_ON_VERB_WORDS.has(value3[value3.length - 1] ?? "")
      ) {
        continue;
      }
      let value4 = usage.slice(value2 + value[0].length),
        value5 = value4.search(CONTRAST_CLAUSE_BOUNDARY_PATTERN);
      if (value5 >= 0) {
        value4 = value4.slice(0, value5);
      }
      let items: Editor.ContrastMention[] = [];
      for (let value7 of matchers) {
        if (
          value7.name === name ||
          entries.has(value7.name) ||
          items.some((input): boolean => input.name === value7.name)
        ) {
          continue;
        }
        let value8 = value7.re.exec(value4);
        if (value8 === null) {
          continue;
        }
        let value9 = value8.index + (value8[1] ?? "").length;
        if (
          items.some(
            (input) =>
              value9 < input.end &&
              value8.index + value8[0].length > input.start,
          )
        ) {
          continue;
        }
        items.push({
          name: value7.name,
          start: value9,
          end: value8.index + value8[0].length,
        });
      }
      items.sort((input, options) => input.start - options.start);
      let value6 = -1;
      for (let value7 of items) {
        if (
          value6 >= 0 &&
          !CONTRAST_TOKEN_JOIN_PATTERN.test(value4.slice(value6, value7.start))
        ) {
          break;
        }
        entries.set(value7.name, value2 + value7.start);
        value6 = value7.end;
      }
    }
    return [...entries.entries()]
      .sort((input, options) => input[1] - options[1])
      .map(([input]) => input);
  }
  function inferColorContrastPairs(
    tokens: Pick<Application.EditorColorToken, "name" | "usage">[],
  ): Map<string, Editor.InferredContrastPair> {
    let values = new Set(tokens.map((input) => input.name)),
      value = (0, runtime.commonTokenNamePrefix)([...values]),
      value2 = contrastTokenMatchers(values, value),
      value3 = tokens
        .filter(
          (input) =>
            colorTokenRole(input.name, value) === COLOR_SURFACE_ROLE &&
            !runtime.NUMERIC_TOKEN_SUFFIX_PATTERN.test(
              stripTokenNamespace(input.name, value),
            ) &&
            isGeneralSurfaceToken(input.name, value),
        )
        .map((input) => input.name),
      entries = new Map<string, Editor.InferredContrastPair>();
    for (let value4 of tokens) {
      let value5 = colorTokenRole(value4.name, value);
      if (value5 === COLOR_SURFACE_ROLE || value5 === COLOR_BORDER_ROLE) {
        continue;
      }
      let value6 = (0, runtime.splitTokenName)(
          stripTokenNamespace(value4.name, value),
        ).map((input: string) => input.toLowerCase()),
        value7 =
          value5 === COLOR_ON_ROLE
            ? 0
            : value5 === COLOR_TEXT_ROLE
              ? value6.indexOf("on", 1)
              : -1;
      if (
        value5 === COLOR_TEXT_ROLE &&
        value6
          .slice(1, value7 > 0 ? value7 : undefined)
          .some(
            (input: string) =>
              CONTRAST_HIGHLIGHT_WORDS.has(input) ||
              colorTokenRole(input, "") === COLOR_SURFACE_ROLE,
          )
      ) {
        continue;
      }
      if (
        value6.some((input: string) => CONTRAST_EXCLUDED_TOKEN_WORDS.has(input))
      ) {
        continue;
      }
      let value8 =
        value5 === COLOR_TEXT_ROLE ||
        value5 === COLOR_ON_ROLE ||
        (value4.usage !== undefined &&
          CONTRAST_TEXT_USAGE_PATTERN.test(value4.usage))
          ? contrastBackgroundsInUsage(value4.usage, value4.name, value2)
          : [];
      if (value8.length > 0) {
        entries.set(value4.name, {
          against: value8,
          source: "usage",
        });
        continue;
      }
      if (value7 >= 0) {
        let value9 = (0, runtime.splitTokenName)(
            stripTokenNamespace(value4.name, value),
          )
            .slice(value7 + 1)
            .join(runtime.TOKEN_NAME_SEPARATOR),
          value10 = [value + value9, value9].find(
            (input) =>
              input !== "" &&
              input !== value4.name &&
              values.has(input) &&
              isContrastBackgroundToken(input, value),
          );
        if (value10 !== undefined) {
          entries.set(value4.name, {
            against: [value10],
            source: "on",
          });
        }
        continue;
      }
      if (value5 === COLOR_TEXT_ROLE) {
        let value9 = value3.filter((input): boolean => input !== value4.name);
        if (value9.length > 0) {
          entries.set(value4.name, {
            against: value9,
            source: "name",
          });
        }
      }
    }
    return entries;
  }
  bindRuntimeValue(
    runtime,
    "COLOR_ROLE_WORDS",
    () => COLOR_ROLE_WORDS,
    (value) => {
      COLOR_ROLE_WORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_SURFACE_ROLE",
    () => COLOR_SURFACE_ROLE,
    (value) => {
      COLOR_SURFACE_ROLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_TEXT_ROLE",
    () => COLOR_TEXT_ROLE,
    (value) => {
      COLOR_TEXT_ROLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_BORDER_ROLE",
    () => COLOR_BORDER_ROLE,
    (value) => {
      COLOR_BORDER_ROLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_ON_ROLE",
    () => COLOR_ON_ROLE,
    (value) => {
      COLOR_ON_ROLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripTokenNamespace",
    () => stripTokenNamespace,
    (value) => {
      stripTokenNamespace = value;
    },
  );
  bindRuntimeValue(runtime, "colorTokenRole", () => colorTokenRole);
  bindRuntimeValue(
    runtime,
    "CONTRAST_EXCLUDED_TOKEN_WORDS",
    () => CONTRAST_EXCLUDED_TOKEN_WORDS,
    (value) => {
      CONTRAST_EXCLUDED_TOKEN_WORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_HIGHLIGHT_WORDS",
    () => CONTRAST_HIGHLIGHT_WORDS,
    (value) => {
      CONTRAST_HIGHLIGHT_WORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_SURFACE_MODIFIER_WORDS",
    () => CONTRAST_SURFACE_MODIFIER_WORDS,
    (value) => {
      CONTRAST_SURFACE_MODIFIER_WORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_ON_VERB_WORDS",
    () => CONTRAST_ON_VERB_WORDS,
    (value) => {
      CONTRAST_ON_VERB_WORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_NEGATION_WORDS",
    () => CONTRAST_NEGATION_WORDS,
    (value) => {
      CONTRAST_NEGATION_WORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_TEXT_USAGE_PATTERN",
    () => CONTRAST_TEXT_USAGE_PATTERN,
    (value) => {
      CONTRAST_TEXT_USAGE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_ON_WORD_PATTERN",
    () => CONTRAST_ON_WORD_PATTERN,
    (value) => {
      CONTRAST_ON_WORD_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_CLAUSE_BOUNDARY_PATTERN",
    () => CONTRAST_CLAUSE_BOUNDARY_PATTERN,
    (value) => {
      CONTRAST_CLAUSE_BOUNDARY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_CLAUSE_BOUNDARIES_PATTERN",
    () => CONTRAST_CLAUSE_BOUNDARIES_PATTERN,
    (value) => {
      CONTRAST_CLAUSE_BOUNDARIES_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_TOKEN_JOIN_PATTERN",
    () => CONTRAST_TOKEN_JOIN_PATTERN,
    (value) => {
      CONTRAST_TOKEN_JOIN_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "escapeContrastRegex",
    () => escapeContrastRegex,
    (value) => {
      escapeContrastRegex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isContrastBackgroundToken",
    () => isContrastBackgroundToken,
  );
  bindRuntimeValue(
    runtime,
    "isGeneralSurfaceToken",
    () => isGeneralSurfaceToken,
  );
  bindRuntimeValue(
    runtime,
    "contrastTokenMatchers",
    () => contrastTokenMatchers,
  );
  bindRuntimeValue(
    runtime,
    "contrastBackgroundsInUsage",
    () => contrastBackgroundsInUsage,
  );
  bindRuntimeValue(
    runtime,
    "inferColorContrastPairs",
    () => inferColorContrastPairs,
  );
  return () => {
    COLOR_ROLE_WORDS = [
      [
        "surface",
        "bg",
        "background",
        "page",
        "ground",
        "canvas",
        "paper",
        "base",
      ],
      ["text", "ink", "fg", "foreground", "copy", "heading", "body"],
      [
        "accent",
        "brand",
        "primary",
        "secondary",
        "fill",
        "link",
        "action",
        "interactive",
      ],
      [
        "border",
        "divider",
        "line",
        "rule",
        "stroke",
        "outline",
        "separator",
        "hairline",
      ],
      ["on", "oncolor"],
    ];
    COLOR_SURFACE_ROLE = 0;
    COLOR_TEXT_ROLE = 1;
    COLOR_BORDER_ROLE = 3;
    COLOR_ON_ROLE = 4;
    stripTokenNamespace = (name: string, namespace: string) =>
      namespace !== "" &&
      name.startsWith(namespace) &&
      name.length > namespace.length
        ? name.slice(namespace.length)
        : name;
    CONTRAST_EXCLUDED_TOKEN_WORDS = new Set([
      "disabled",
      "inactive",
      "inverse",
      "inverted",
      "reverse",
    ]);
    CONTRAST_HIGHLIGHT_WORDS = new Set([
      "highlight",
      "wash",
      "tint",
      "selection",
    ]);
    CONTRAST_SURFACE_MODIFIER_WORDS = new Set([
      "default",
      "base",
      "main",
      "plain",
      "subtle",
      "subtler",
      "subtlest",
      "muted",
      "soft",
      "secondary",
      "tertiary",
      "raised",
      "sunken",
      "inset",
      "elevated",
      "lowest",
      "lower",
      "low",
      "high",
      "higher",
      "highest",
      "dim",
      "bright",
      "container",
      "card",
      "panel",
      "popover",
      "sheet",
      "page",
      "canvas",
      "app",
      "body",
      "alt",
      "layer",
      "level",
    ]);
    CONTRAST_ON_VERB_WORDS = new Set([
      "based",
      "depend",
      "depends",
      "depending",
      "rely",
      "relies",
      "relying",
      "build",
      "builds",
      "building",
      "built",
      "turn",
      "turns",
      "turning",
      "turned",
      "focus",
      "focuses",
      "focusing",
      "focused",
      "click",
      "clicking",
      "clicked",
    ]);
    CONTRAST_NEGATION_WORDS = new Set([
      "never",
      "not",
      "avoid",
      "dont",
      "don’t",
      "don't",
      "except",
    ]);
    CONTRAST_TEXT_USAGE_PATTERN =
      /\b(?:text|label|copy|heading|caption|type)s?\b/i;
    CONTRAST_ON_WORD_PATTERN = /(?<![A-Za-z0-9_-])on(?![A-Za-z0-9_-])/gi;
    CONTRAST_CLAUSE_BOUNDARY_PATTERN = /[.;:()\u2014]|\s[-\u2013]\s/;
    CONTRAST_CLAUSE_BOUNDARIES_PATTERN = /[.;:()\u2014]|\s[-\u2013]\s/g;
    CONTRAST_TOKEN_JOIN_PATTERN =
      /^[\s`,/&]*(?:(?:and|or|either|the|a|an)\b[\s`,/&]*)*$/i;
    escapeContrastRegex = (input: string) =>
      input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };
}
