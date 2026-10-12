import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelComponentInference(
  runtime: RuntimeBindings,
): () => void {
  var DEFAULT_COMPONENT_PREVIEW_HEIGHT: number;
  var MAX_COMPONENT_GROUP_LABEL_LENGTH: number;
  var COMPONENT_CARD_HEADER_PATTERN: RegExp;
  var COMPONENT_CARD_ATTRIBUTE_PATTERN: RegExp;
  var NUMERIC_TOKEN_SUFFIX_PATTERN: RegExp;
  var TOKEN_NAME_SEPARATOR: string;
  var PALETTE_GROUP_NAME: string;
  var MAX_INFERRED_COMPONENT_PROPS: number;
  var MAX_REFERENCED_TYPE_NAMES: number;
  var MAX_TYPE_BODY_MEMBERS: number;
  var MAX_TYPE_INFERENCE_WORK: number;
  var MAX_TYPE_INFERENCE_SCANNED_CHARACTERS: number;
  var TYPE_INFERENCE_OVER_BUDGET: symbol;
  var MAX_PROPS_INHERITANCE_DEPTH: number;
  var TYPE_IDENTIFIER_PATTERN: RegExp;
  var QUOTED_TYPE_LITERAL_PATTERN: RegExp;
  var NUMERIC_TYPE_LITERAL_PATTERN: RegExp;
  var MAX_TYPE_RESOLUTION_DEPTH: number;
  var MAX_TEMPLATE_TYPE_EXPANSIONS: number;
  var MAX_ENUM_CONTROL_OPTIONS: number;
  var MIN_NUMERIC_ENUM_OPTIONS: number;
  var NON_EDITABLE_REACT_TYPES: Set<string>;
  var typeLiteralSets: WeakMap<string[], Set<string>>;
  var TypeDeclarationResolver: M.TypeDeclarationResolverConstructor;
  var OMITTED_COMPONENT_PROPS: Set<string>;
  var cachedTypeDeclarationResolver: M.ResolverCache | null;
  var typeInferenceIncomplete: boolean;
  function clampSingleLineText(text: string, maxLength: number): string {
    let characters = Array.from<string>(text.replace(/[\r\n\t]+/g, " ").trim());
    if (characters.length > maxLength) {
      return characters.slice(0, maxLength).join("").trim();
    } else {
      return characters.join("");
    }
  }
  function parseComponentCardHeader(
    html: string,
  ): Core.ComponentCardMetadata | null {
    let header = COMPONENT_CARD_HEADER_PATTERN.exec(
      html.charCodeAt(0) === 65279 ? html.slice(1) : html,
    );
    if (header === null) {
      return null;
    }
    let metadata: Core.ComponentCardMetadata = {};
    for (let value of (header[1] ?? "")
      .trimEnd()
      .matchAll(COMPONENT_CARD_ATTRIBUTE_PATTERN)) {
      let value2 = (value[1] ?? "").toLowerCase(),
        value3 = value[2] ?? value[3] ?? "";
      if (value2 === "group") {
        let value4 = clampSingleLineText(value3, 64);
        if (value4 !== "" && !/[<>"]/.test(value4)) {
          metadata.group = value4;
        }
      } else if (value2 === "height") {
        let value4: number = Number(value3);
        if (value3 !== "" && Number.isFinite(value4)) {
          metadata.height = Math.round(Math.min(4000, Math.max(40, value4)));
        }
      } else if (value2 === "width") {
        let value4: number = Number(value3);
        if (value3 !== "" && Number.isFinite(value4)) {
          metadata.width = Math.round(Math.min(4000, Math.max(240, value4)));
        }
      } else if (value2 === "subtitle") {
        let value4 = clampSingleLineText(value3, 120);
        if (value4 !== "") {
          metadata.subtitle = value4;
        }
      } else if (value2 === "floor") {
        metadata.floor = true;
      } else if (value2 === "page") {
        metadata.page = true;
      }
    }
    return metadata;
  }
  function skipHtmlPreamble(html: string): number {
    let offset: number = html.charCodeAt(0) === 65279 ? 1 : 0;
    while (offset < html.length && /\s/.test(html[offset])) {
      offset++;
    }
    let doctype = /^<!doctype\b[^>]*>\s*/i.exec(
      html.slice(offset, offset + 512),
    );
    if (doctype !== null) {
      return offset + doctype[0].length;
    } else {
      return offset;
    }
  }
  function componentCardMetadata(
    html: string,
  ): Core.ComponentCardMetadata | null {
    let preambleEnd = skipHtmlPreamble(html),
      firstNewline = html.indexOf(
        `
`,
        preambleEnd,
      );
    return parseComponentCardHeader(
      html.slice(preambleEnd, firstNewline < 0 ? undefined : firstNewline),
    );
  }
  function splitTokenName(name: string): string[] {
    return name.split("-");
  }
  function commonTokenNamePrefix(names: readonly string[]): string {
    if (names.length < 2) {
      return "";
    }
    let firstName = names[0],
      commonPrefix = "";
    for (
      let value = firstName.indexOf("-");
      value > 0;
      value = firstName.indexOf("-", value + 1)
    ) {
      let value2 = firstName.slice(0, value + 1);
      if (
        !names.every(
          (items) => items.startsWith(value2) && items.length > value2.length,
        )
      ) {
        break;
      }
      if (names.some((input) => tokenHasGroupSuffix(input, value2))) {
        commonPrefix = value2;
      }
    }
    return commonPrefix;
  }
  function tokenGroupName(name: string, prefix = ""): string {
    let suffix =
        prefix !== "" && name.startsWith(prefix) && name.length > prefix.length
          ? name.slice(prefix.length)
          : name,
      numericMatch = NUMERIC_TOKEN_SUFFIX_PATTERN.exec(suffix);
    if (
      numericMatch !== null &&
      numericMatch[1] !== undefined &&
      numericMatch[1] !== ""
    ) {
      return numericMatch[1];
    }
    let hyphenOffset = suffix.indexOf("-");
    if (hyphenOffset > 0) {
      return suffix.slice(0, hyphenOffset);
    } else {
      return suffix;
    }
  }
  function tokenHasGroupSuffix(name: string, prefix = ""): boolean {
    let suffix =
      prefix !== "" && name.startsWith(prefix) && name.length > prefix.length
        ? name.slice(prefix.length)
        : name;
    return tokenGroupName(name, prefix) !== suffix;
  }
  function groupTokensByName<Token extends { name: string }>(
    tokens: readonly Token[],
  ): M.TokenNameGroup<Token>[] {
    let prefix = commonTokenNamePrefix(tokens.map((input) => input.name)),
      groups = new Map<string, Token[]>(),
      ungrouped: Token[] = [];
    for (let value of tokens) {
      if (!tokenHasGroupSuffix(value.name, prefix)) {
        ungrouped.push(value);
        continue;
      }
      let value2 = tokenGroupName(value.name, prefix),
        entry = groups.get(value2);
      if (entry === undefined) {
        groups.set(value2, (entry = []));
      }
      entry.push(value);
    }
    let groupEntries = [...groups.entries()].map(
      ([input, input2]: [string, Token[]]) => ({
        name: input,
        tokens: input2,
      }),
    );
    if (ungrouped.length > 0) {
      return [
        {
          name: "",
          tokens: ungrouped,
        },
        ...groupEntries,
      ];
    } else {
      return groupEntries;
    }
  }
  function groupColorPaletteTokens(
    tokens: Core.NormalizedTokens,
  ): M.ColorPaletteGroup[] {
    let byGroup = new Map<
        string,
        Core.NormalizedTokens["color"]["tokens"][number][]
      >(),
      prefix = commonTokenNamePrefix(
        tokens.color.tokens.map((input) => input.name),
      );
    for (let value of tokens.color.tokens) {
      let value2 = tokenGroupName(value.name, prefix),
        entry = byGroup.get(value2);
      if (entry === undefined) {
        byGroup.set(value2, (entry = []));
      }
      entry.push(value);
    }
    let palettes: M.ColorPaletteGroup[] = [];
    for (let [value, value2] of byGroup) {
      if (
        value2.some((input) => tokenHasGroupSuffix(input.name, prefix)) &&
        value2.length >= 1
      ) {
        palettes.push({
          name: value,
          numeric: value2.every((input) =>
            NUMERIC_TOKEN_SUFFIX_PATTERN.test(input.name),
          ),
          tokens: value2,
        });
      }
    }
    let paletteNames = new Set(palettes.map((input) => input.name)),
      ungrouped = [...byGroup.entries()]
        .filter(([input]): boolean => !paletteNames.has(input))
        .flatMap(([, input]) => input);
    ungrouped.sort(
      (input, options) =>
        tokens.color.tokens.indexOf(input) -
        tokens.color.tokens.indexOf(options),
    );
    if (ungrouped.length > 0) {
      return [
        {
          name: "",
          numeric: false,
          tokens: ungrouped,
        },
        ...palettes,
      ];
    } else {
      return palettes;
    }
  }
  function coerceControlOption(
    control: M.InferredControl,
    option: string,
  ): string | number | boolean {
    if (control.numeric === true) {
      return Number(option);
    }
    if (
      control.withBool === true &&
      (option === "true" || option === "false")
    ) {
      return option === "true";
    }
    return option;
  }
  function isValidTypeDeclarationName(name: string): boolean {
    return TYPE_IDENTIFIER_PATTERN.test(name) && name.length <= 80;
  }
  function skipBalancedTypeExpression(text: string, start: number): number {
    let open = text[start],
      close: string =
        open === "{" ? "}" : open === "(" ? ")" : open === "[" ? "]" : ">",
      depth: number = 0;
    for (let value = start; value < text.length; value++) {
      let value2 = text[value];
      if (value2 === '"' || value2 === "'" || value2 === "`") {
        let value3 = value2;
        value++;
        while (value < text.length && text[value] !== value3) {
          if (text[value] === "\\") {
            value++;
          }
          value++;
        }
        continue;
      }
      if (value2 === "/" && text[value + 1] === "*") {
        let value3 = text.indexOf("*/", value + 2);
        if (value3 === -1) {
          return -1;
        }
        value = value3 + 1;
        continue;
      }
      if (value2 === "/" && text[value + 1] === "/") {
        let value3 = text.indexOf(
          `
`,
          value,
        );
        if (value3 === -1) {
          return -1;
        }
        value = value3;
        continue;
      }
      if (value2 === open) {
        depth++;
      } else if (value2 === close) {
        depth--;
        if (depth === 0) {
          return value + 1;
        }
      }
    }
    return -1;
  }
  function typeDeclarationEnd(text: string, start: number): number {
    let offset = start;
    while (offset < text.length) {
      let value = text[offset];
      if (value === ";") {
        return offset;
      }
      if (value === "{" || value === "(" || value === "[") {
        let value2 = skipBalancedTypeExpression(text, offset);
        if (value2 === -1) {
          return text.length;
        }
        offset = value2;
        continue;
      }
      if (value === '"' || value === "'" || value === "`") {
        let value2 = value;
        offset++;
        while (offset < text.length && text[offset] !== value2) {
          if (text[offset] === "\\") {
            offset++;
          }
          offset++;
        }
        offset++;
        continue;
      }
      if (value === "/" && text[offset + 1] === "*") {
        let value2 = text.indexOf("*/", offset + 2);
        offset = value2 === -1 ? text.length : value2 + 2;
        continue;
      }
      if (value === "/" && text[offset + 1] === "/") {
        let value2 = text.indexOf(
          `
`,
          offset,
        );
        offset = value2 === -1 ? text.length : value2 + 1;
        continue;
      }
      offset++;
    }
    return text.length;
  }
  function findTypeDeclaration(
    texts: readonly string[],
    name: string,
  ): M.TypeDeclaration | null {
    for (let value of texts) {
      for (let value2 of ["interface", "type", "const", "enum"] as const) {
        let index = 0,
          value3: string = value2 + " " + name;
        for (;;) {
          let value4 = value.indexOf(value3, index);
          if (value4 === -1) {
            break;
          }
          index = value4 + value3.length;
          let value5 = value4 === 0 ? " " : (value[value4 - 1] ?? " "),
            value6 = value[index] ?? " ";
          if (/[\w$]/.test(value5) || /[\w$]/.test(value6)) {
            continue;
          }
          if (value2 === "interface" || value2 === "enum") {
            let value11 = value.indexOf("{", index);
            if (value11 === -1) {
              break;
            }
            let value12 = skipBalancedTypeExpression(value, value11);
            if (value12 === -1) {
              break;
            }
            return {
              kind: value2,
              head: value.slice(index, value11),
              body: value.slice(value11 + 1, value12 - 1),
            };
          }
          let value7 = value
              .slice(index)
              .replace(/^\s*(?:<[^=]*>\s*)?[=:]\s*/, ""),
            value8 = value.length - index - value7.length,
            value9 = index + value8,
            value10 = typeDeclarationEnd(value, value9);
          return {
            kind: value2,
            head: value.slice(value9, value10),
            body: "",
          };
        }
      }
    }
    return null;
  }
  function parseTypeBodyMembers(body: string): M.TypeBodyMember[] {
    let members: M.TypeBodyMember[] = [],
      offset = 0,
      doc = "";
    while (offset < body.length && members.length < MAX_TYPE_BODY_MEMBERS) {
      let value = body[offset];
      if (
        value === " " ||
        value ===
          `
` ||
        value === "\t" ||
        value === "\r"
      ) {
        offset++;
        continue;
      }
      if (value === "/" && body[offset + 1] === "*") {
        let value5 = body.indexOf("*/", offset + 2),
          value6 = body.slice(offset, value5 === -1 ? body.length : value5 + 2);
        doc = value6.startsWith("/**") ? value6 : "";
        offset = value5 === -1 ? body.length : value5 + 2;
        continue;
      }
      if (value === "/" && body[offset + 1] === "/") {
        let value5 = body.indexOf(
          `
`,
          offset,
        );
        offset = value5 === -1 ? body.length : value5 + 1;
        continue;
      }
      let value2 = typeDeclarationEnd(body, offset),
        value3 = body.slice(offset, value2);
      offset = value2 + 1;
      let value4 =
        /^\s*(?:readonly\s+)?(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))(?:\s*(\?))?\s*:\s*([\s\S]+)$/.exec(
          value3,
        );
      if (value4 !== null) {
        let value5 = value4[1] ?? value4[2] ?? value4[3] ?? "";
        members.push({
          name: value5,
          optional: value4[4] !== undefined,
          type: (value4[5] ?? "").trim(),
          doc: doc,
        });
      }
      doc = "";
    }
    return members;
  }
  function referencedTypeNames(head: string): string[] {
    let outerText = "",
      offset = 0;
    while (offset < head.length) {
      if (head[offset] === "{") {
        let value = skipBalancedTypeExpression(head, offset);
        if (value === -1) {
          break;
        }
        offset = value;
        continue;
      }
      outerText += head[offset];
      offset++;
    }
    let names: string[] = [],
      identifierPattern: RegExp = /\b([A-Z][\w$]*)\b(\s*\[)?/g,
      match: RegExpExecArray | null;
    while ((match = identifierPattern.exec(outerText)) !== null) {
      let value = match[1] ?? "";
      if (match[2] !== undefined) {
        continue;
      }
      if (
        value === "Omit" ||
        value === "Pick" ||
        value === "Partial" ||
        value === "Required" ||
        value === "NonNullable" ||
        value === "Readonly" ||
        value === "React"
      ) {
        continue;
      }
      if (!names.includes(value)) {
        names.push(value);
      }
      if (names.length >= MAX_REFERENCED_TYPE_NAMES) {
        break;
      }
    }
    return names;
  }
  function inlineTypeObjectBodies(head: string): string[] {
    let bodies: string[] = [],
      offset = 0;
    while (offset < head.length) {
      let value = head[offset];
      if (value === "{") {
        let value2 = skipBalancedTypeExpression(head, offset);
        if (value2 === -1) {
          break;
        }
        bodies.push(head.slice(offset + 1, value2 - 1));
        offset = value2;
        continue;
      }
      if (value === "(" || value === "[") {
        offset++;
        continue;
      }
      if (value === "<") {
        let value2 = skipBalancedTypeExpression(head, offset);
        offset = value2 === -1 ? head.length : value2;
        continue;
      }
      offset++;
    }
    return bodies;
  }
  function createTypeInferenceState(): M.TypeInferenceState {
    return {
      literals: [],
      numeric: true,
      str: false,
      num: false,
      bool: false,
      node: false,
      other: false,
      unresolved: [],
    };
  }
  function appendTypeLiteral(
    state: M.TypeInferenceState,
    literal: string,
    forceString = false,
  ): void {
    let literals = typeLiteralSets.get(state.literals);
    if (literals === undefined) {
      typeLiteralSets.set(state.literals, (literals = new Set(state.literals)));
    }
    if (literals.size > MAX_ENUM_CONTROL_OPTIONS) {
      return;
    }
    if (!literals.has(literal)) {
      literals.add(literal);
      state.literals.push(literal);
    }
    if (forceString || !NUMERIC_TYPE_LITERAL_PATTERN.test(literal)) {
      state.numeric = false;
    }
  }
  function mergeInferredControl(
    state: M.TypeInferenceState,
    control: M.InferredControl | null,
  ): void {
    if (control === null) {
      state.other = true;
      return;
    }
    if (control.kind === "enum") {
      let value = control.options ?? [];
      if (control.withBool === true) {
        state.bool = true;
      }
      for (let value2 of control.withBool === true ? value.slice(2) : value) {
        appendTypeLiteral(state, value2);
      }
      if (control.numeric !== true) {
        state.numeric = false;
      }
    } else if (control.kind === "boolean") {
      state.bool = true;
    } else if (control.kind === "number") {
      state.num = true;
    } else if (((state.str = true), control.typeName !== undefined)) {
      state.unresolved.push(control.typeName);
    }
  }
  function enumControlFromLiterals(
    values: readonly string[],
  ): M.InferredControl {
    let control: M.InferredControl = {
      kind: "enum",
      options: [...new Set(values)].slice(0, MAX_ENUM_CONTROL_OPTIONS + 1),
    };
    if (
      control.options !== undefined &&
      control.options.length > 0 &&
      control.options.every((input) => NUMERIC_TYPE_LITERAL_PATTERN.test(input))
    ) {
      control.numeric = true;
    }
    return control;
  }
  function inferEnumDeclaration(body: string): M.InferredControl | null {
    let options: string[] = [],
      numeric: boolean = true,
      nextNumericValue = 0;
    for (let value of splitTypeExpression(stripTypeComments(body), ",")) {
      let value2 =
        /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*(?:=([\s\S]*))?$/.exec(
          value.trim(),
        );
      if (value2 === null) {
        continue;
      }
      let value3 =
        value2[4] === undefined ? undefined : value2[4].trim() || undefined;
      if (value3 === undefined) {
        options.push(String(nextNumericValue++));
        continue;
      }
      let value4 = QUOTED_TYPE_LITERAL_PATTERN.exec(value3);
      if (value4 !== null) {
        options.push(value4[1] ?? value4[2] ?? "");
        numeric = false;
        continue;
      }
      if (NUMERIC_TYPE_LITERAL_PATTERN.test(value3)) {
        options.push(value3);
        nextNumericValue = Number(value3) + 1;
        continue;
      }
      return null;
    }
    if (options.length === 0) {
      return null;
    }
    let control: M.InferredControl = {
      kind: "enum",
      options: options,
    };
    if (numeric) {
      control.numeric = true;
    }
    return control;
  }
  function arrayElementTypeExpression(typeText: string): string {
    let normalized = unwrapTypeExpression(stripTypeComments(typeText)).replace(
      /^readonly\s+/,
      "",
    );
    if (normalized.startsWith("[") && normalized.endsWith("]")) {
      return splitTypeExpression(normalized.slice(1, -1), ",").join(" | ");
    }
    let arrayMatch = /^(?:ReadonlyArray|Array)\s*<([\s\S]*)>$/.exec(normalized);
    if (arrayMatch !== null) {
      return arrayMatch[1] ?? "";
    }
    if (normalized.endsWith("[]")) {
      return normalized.slice(0, -2);
    }
    return normalized;
  }
  function stripTypeComments(text: string): string {
    let withoutComments = "",
      copyOffset = 0,
      offset = 0;
    while (offset < text.length) {
      let value = text[offset];
      if (value === '"' || value === "'" || value === "`") {
        offset++;
        while (offset < text.length && text[offset] !== value) {
          offset += text[offset] === "\\" ? 2 : 1;
        }
        offset++;
        continue;
      }
      if (value === "/" && text[offset + 1] === "*") {
        withoutComments += text.slice(copyOffset, offset);
        let value2 = text.indexOf("*/", offset + 2);
        if (value2 === -1) {
          return withoutComments.trim();
        }
        offset = copyOffset = value2 + 2;
        continue;
      }
      offset++;
    }
    return (withoutComments + text.slice(copyOffset)).trim();
  }
  function unwrapTypeExpression(text: string): string {
    let unwrapped = text.trim();
    for (
      let index: number = 0;
      index < 8 &&
      unwrapped.startsWith("(") &&
      skipBalancedTypeExpression(unwrapped, 0) === unwrapped.length;
      index++
    ) {
      unwrapped = unwrapped.slice(1, -1).trim();
    }
    return unwrapped;
  }
  function conciseTypeDescription(typeText: string): string {
    let description = stripTypeComments(typeText).replace(/\s+/g, " ");
    if (description.length > 40) {
      return description.slice(0, 37) + "…";
    } else {
      return description;
    }
  }
  function splitTypeExpression(text: string, separator: string): string[] {
    let parts: string[] = [],
      depth: number = 0,
      partStart = 0,
      offset: number = 0;
    while (offset < text.length) {
      let value = text[offset];
      if (value === '"' || value === "'" || value === "`") {
        let value2 = value;
        offset++;
        while (offset < text.length && text[offset] !== value2) {
          if (text[offset] === "\\") {
            offset++;
          }
          offset++;
        }
        offset++;
        continue;
      }
      if (value === "{" || value === "(" || value === "[" || value === "<") {
        depth++;
      } else if (
        value === "}" ||
        value === ")" ||
        value === "]" ||
        value === ">"
      ) {
        if (!(value === ">" && text[offset - 1] === "=")) {
          depth--;
        }
      } else if (value === separator && depth === 0) {
        parts.push(text.slice(partStart, offset).trim());
        partStart = offset + 1;
      }
      offset++;
    }
    parts.push(text.slice(partStart).trim());
    return parts.filter((input): boolean => input !== "");
  }
  function inferVariantPropsType(
    typeText: string,
    resolver: M.TypeDeclarationResolver,
  ) {
    let variantMatch =
      /VariantProps<typeof\s+([A-Za-z_$][\w$]*)>\s*\[\s*"([^"]+)"\s*\]/.exec(
        typeText,
      );
    if (variantMatch === null) {
      return null;
    }
    let declaration = resolver.decl(variantMatch[1] ?? "");
    if (declaration === null) {
      return null;
    }
    let variantKey = variantMatch[2] ?? "";
    for (let value of resolver.heads(declaration.head)) {
      for (let value2 of resolver.members(value)) {
        if (value2.name === variantKey) {
          return value2.type;
        }
      }
    }
    return null;
  }
  function parseJSDocDefault(
    doc: string,
    control: M.InferredControl,
  ): string | number | boolean | undefined {
    let defaultMatch =
      /@default\s+(?:`([^`]*)`|"([^"]*)"|'([^']*)'|(\S+))/.exec(doc);
    if (defaultMatch === null) {
      return;
    }
    let rawDefault = (
      defaultMatch[1] ??
      defaultMatch[2] ??
      defaultMatch[3] ??
      defaultMatch[4] ??
      ""
    ).replace(/^["'`]|["'`]$/g, "");
    if (control.kind === "boolean") {
      if (rawDefault === "true") {
        return true;
      } else {
        if (rawDefault === "false") {
          return false;
        } else {
          return undefined;
        }
      }
    }
    if (control.kind === "number") {
      let value: number = Number(rawDefault);
      if (Number.isFinite(value)) {
        return value;
      } else {
        return undefined;
      }
    }
    if (control.kind === "enum") {
      if (control.options?.includes(rawDefault) !== true) {
        return;
      }
      return coerceControlOption(control, rawDefault);
    }
    return rawDefault;
  }
  function wasTypeInferenceIncomplete(): boolean {
    return typeInferenceIncomplete;
  }
  function getTypeDeclarationResolver(
    texts: readonly string[],
  ): M.TypeDeclarationResolver {
    if (
      cachedTypeDeclarationResolver !== null &&
      cachedTypeDeclarationResolver.texts.length === texts.length &&
      cachedTypeDeclarationResolver.texts.every(
        (input, options): boolean => input === texts[options],
      )
    ) {
      return cachedTypeDeclarationResolver.rs.reuse();
    }
    let resolver = new TypeDeclarationResolver(texts);
    cachedTypeDeclarationResolver = {
      texts: texts,
      rs: resolver,
    };
    return resolver;
  }
  function inferComponentPropControls(
    componentName: string,
    texts: readonly (string | undefined)[],
    options?: { keep?: readonly string[] },
  ) {
    typeInferenceIncomplete = false;
    let declarationTexts = texts.filter(
      (input): input is string => typeof input === "string" && input !== "",
    );
    if (
      !isValidTypeDeclarationName(componentName) ||
      declarationTexts.length === 0
    ) {
      return [];
    }
    let keepProps = new Set(options?.keep),
      controls = new Map<string, Core.InferredPropControl>(),
      visitedTypes = new Set<string>(),
      resolver = getTypeDeclarationResolver(declarationTexts),
      visitPropsType = (input: string, options2: number): void => {
        if (
          options2 > MAX_PROPS_INHERITANCE_DEPTH ||
          visitedTypes.has(input) ||
          controls.size >= MAX_INFERRED_COMPONENT_PROPS
        ) {
          return;
        }
        visitedTypes.add(input);
        let value = resolver.decl(input);
        if (value === null || value.kind === "const" || value.kind === "enum") {
          return;
        }
        let value2 =
          value.kind === "interface"
            ? [value.body]
            : resolver.heads(value.head);
        for (let value3 of value2) {
          for (let value4 of resolver.members(value3)) {
            resolver.tick();
            if (controls.size >= MAX_INFERRED_COMPONENT_PROPS) {
              break;
            }
            if (
              (OMITTED_COMPONENT_PROPS.has(value4.name) &&
                !keepProps.has(value4.name)) ||
              (value4.name.startsWith("on") && /^on[A-Z]/.test(value4.name))
            ) {
              continue;
            }
            if (/@deprecated\b/.test(value4.doc)) {
              continue;
            }
            if (/^\s*never\s*$/.test(value4.type)) {
              continue;
            }
            let value5 = resolver.resolve(value4.type, 0);
            if (value5 === null) {
              continue;
            }
            let entry = controls.get(value4.name);
            if (
              entry !== undefined &&
              !(
                entry.kind === "string" &&
                entry.typeName !== undefined &&
                value5.kind !== "string"
              )
            ) {
              continue;
            }
            let state: Core.InferredPropControl = {
              name: value4.name,
              kind: value5.kind,
            };
            if (value5.options !== undefined) {
              state.options = value5.options;
            }
            if (value5.numeric === true) {
              state.numeric = true;
            }
            if (value5.withBool === true) {
              state.withBool = true;
            }
            if (value5.typeName !== undefined) {
              state.typeName = value5.typeName;
            }
            let value6 = parseJSDocDefault(value4.doc, value5);
            if (value6 !== undefined) {
              state.default = value6;
            }
            if (!value4.optional) {
              state.required = true;
            }
            controls.set(value4.name, state);
          }
        }
        resolver.charge(value.head.length);
        for (let value3 of referencedTypeNames(value.head)) {
          visitPropsType(value3, options2 + 1);
        }
      };
    try {
      visitPropsType(componentName + "Props", 0);
    } catch (value: unknown) {
      cachedTypeDeclarationResolver = null;
      if (value !== TYPE_INFERENCE_OVER_BUDGET) {
        throw value;
      }
      typeInferenceIncomplete = true;
      return [];
    }
    let result = [...controls.values()];
    result.sort((input, options2): number =>
      input.name === "children" ? -1 : options2.name === "children" ? 1 : 0,
    );
    return result;
  }
  function jsonForInlineScript(value: M.JsonValue): string {
    return JSON.stringify(value)!.replaceAll("<", "\\u003c");
  }
  function generateComponentMountHtml(
    componentName: string,
    options: M.ComponentMountOptions,
  ): string {
    let namespace = options.namespace;
    if (
      !isValidTypeDeclarationName(componentName) ||
      !isValidTypeDeclarationName(namespace)
    ) {
      return (
        '<p style="font:13px system-ui;color:#888;padding:16px">This preview has no window namespace to render ' +
        escapeHtmlAttribute(componentName) +
        " from.</p>"
      );
    }
    let reactGlobal =
        options.globals.find((input) => /^react$/i.test(input)) ?? "React",
      domGlobal =
        options.globals.find((input) => /^reactdom$/i.test(input)) ??
        "ReactDOM";
    if (
      !isValidTypeDeclarationName(reactGlobal) ||
      !isValidTypeDeclarationName(domGlobal)
    ) {
      return "";
    }
    let configurationJson = jsonForInlineScript({
      ns: namespace,
      name: componentName,
      react: reactGlobal,
      dom: domGlobal,
    });
    return (
      '<style>html,body{margin:0}body{padding:16px;font-family:var(--font-sans,system-ui)}#root{display:flex;flex-wrap:wrap;align-items:center;gap:12px}</style><div id="root"></div><script>window.__dsProps = ' +
      jsonForInlineScript(options.values) +
      `;<\/script><script>(function () {
  var cfg = ` +
      configurationJson +
      `;
  var R = window[cfg.react], D = window[cfg.dom], NS = window[cfg.ns];
  var root = document.getElementById("root");
  var C = NS && NS[cfg.name];
  if (!R || !D || typeof C !== 'function' && typeof C !== 'object' || C === null) { root.textContent = cfg.name + ' is not exported from window.' + cfg.ns; root.style.cssText = 'font:13px system-ui;color:#888'; return; }
  var props = Object.assign({}, window.__dsProps);
  var kids = props.children; delete props.children;
  var el = kids === undefined || kids === '' ? R.createElement(C, props) : R.createElement(C, props, kids);
  var Root = NS[cfg.ns + 'Root'] || NS.Root || NS.Provider || NS.ThemeProvider;
  var tree = typeof Root === "function" || typeof Root === "object" && Root !== null ? R.createElement(Root, null, el) : el;
  if (typeof D.createRoot === "function") D.createRoot(root).render(tree); else D.render(tree, root);
})();<\/script>`
    );
  }
  function escapeHtmlAttribute(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  bindRuntimeValue(
    runtime,
    "DEFAULT_COMPONENT_PREVIEW_HEIGHT",
    () => DEFAULT_COMPONENT_PREVIEW_HEIGHT,
    (value) => {
      DEFAULT_COMPONENT_PREVIEW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COMPONENT_GROUP_LABEL_LENGTH",
    () => MAX_COMPONENT_GROUP_LABEL_LENGTH,
    (value) => {
      MAX_COMPONENT_GROUP_LABEL_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMPONENT_CARD_HEADER_PATTERN",
    () => COMPONENT_CARD_HEADER_PATTERN,
    (value) => {
      COMPONENT_CARD_HEADER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMPONENT_CARD_ATTRIBUTE_PATTERN",
    () => COMPONENT_CARD_ATTRIBUTE_PATTERN,
    (value) => {
      COMPONENT_CARD_ATTRIBUTE_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "clampSingleLineText", () => clampSingleLineText);
  bindRuntimeValue(
    runtime,
    "parseComponentCardHeader",
    () => parseComponentCardHeader,
  );
  bindRuntimeValue(runtime, "skipHtmlPreamble", () => skipHtmlPreamble);
  bindRuntimeValue(
    runtime,
    "componentCardMetadata",
    () => componentCardMetadata,
  );
  bindRuntimeValue(
    runtime,
    "NUMERIC_TOKEN_SUFFIX_PATTERN",
    () => NUMERIC_TOKEN_SUFFIX_PATTERN,
    (value) => {
      NUMERIC_TOKEN_SUFFIX_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOKEN_NAME_SEPARATOR",
    () => TOKEN_NAME_SEPARATOR,
    (value) => {
      TOKEN_NAME_SEPARATOR = value;
    },
  );
  bindRuntimeValue(runtime, "splitTokenName", () => splitTokenName);
  bindRuntimeValue(
    runtime,
    "commonTokenNamePrefix",
    () => commonTokenNamePrefix,
  );
  bindRuntimeValue(runtime, "tokenGroupName", () => tokenGroupName);
  bindRuntimeValue(runtime, "tokenHasGroupSuffix", () => tokenHasGroupSuffix);
  bindRuntimeValue(
    runtime,
    "PALETTE_GROUP_NAME",
    () => PALETTE_GROUP_NAME,
    (value) => {
      PALETTE_GROUP_NAME = value;
    },
  );
  bindRuntimeValue(runtime, "groupTokensByName", () => groupTokensByName);
  bindRuntimeValue(
    runtime,
    "groupColorPaletteTokens",
    () => groupColorPaletteTokens,
  );
  bindRuntimeValue(runtime, "coerceControlOption", () => coerceControlOption);
  bindRuntimeValue(
    runtime,
    "MAX_INFERRED_COMPONENT_PROPS",
    () => MAX_INFERRED_COMPONENT_PROPS,
    (value) => {
      MAX_INFERRED_COMPONENT_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_REFERENCED_TYPE_NAMES",
    () => MAX_REFERENCED_TYPE_NAMES,
    (value) => {
      MAX_REFERENCED_TYPE_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TYPE_BODY_MEMBERS",
    () => MAX_TYPE_BODY_MEMBERS,
    (value) => {
      MAX_TYPE_BODY_MEMBERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TYPE_INFERENCE_WORK",
    () => MAX_TYPE_INFERENCE_WORK,
    (value) => {
      MAX_TYPE_INFERENCE_WORK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TYPE_INFERENCE_SCANNED_CHARACTERS",
    () => MAX_TYPE_INFERENCE_SCANNED_CHARACTERS,
    (value) => {
      MAX_TYPE_INFERENCE_SCANNED_CHARACTERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TYPE_INFERENCE_OVER_BUDGET",
    () => TYPE_INFERENCE_OVER_BUDGET,
    (value) => {
      TYPE_INFERENCE_OVER_BUDGET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PROPS_INHERITANCE_DEPTH",
    () => MAX_PROPS_INHERITANCE_DEPTH,
    (value) => {
      MAX_PROPS_INHERITANCE_DEPTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TYPE_IDENTIFIER_PATTERN",
    () => TYPE_IDENTIFIER_PATTERN,
    (value) => {
      TYPE_IDENTIFIER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isValidTypeDeclarationName",
    () => isValidTypeDeclarationName,
  );
  bindRuntimeValue(
    runtime,
    "skipBalancedTypeExpression",
    () => skipBalancedTypeExpression,
  );
  bindRuntimeValue(runtime, "typeDeclarationEnd", () => typeDeclarationEnd);
  bindRuntimeValue(runtime, "findTypeDeclaration", () => findTypeDeclaration);
  bindRuntimeValue(runtime, "parseTypeBodyMembers", () => parseTypeBodyMembers);
  bindRuntimeValue(runtime, "referencedTypeNames", () => referencedTypeNames);
  bindRuntimeValue(
    runtime,
    "inlineTypeObjectBodies",
    () => inlineTypeObjectBodies,
  );
  bindRuntimeValue(
    runtime,
    "QUOTED_TYPE_LITERAL_PATTERN",
    () => QUOTED_TYPE_LITERAL_PATTERN,
    (value) => {
      QUOTED_TYPE_LITERAL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NUMERIC_TYPE_LITERAL_PATTERN",
    () => NUMERIC_TYPE_LITERAL_PATTERN,
    (value) => {
      NUMERIC_TYPE_LITERAL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TYPE_RESOLUTION_DEPTH",
    () => MAX_TYPE_RESOLUTION_DEPTH,
    (value) => {
      MAX_TYPE_RESOLUTION_DEPTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TEMPLATE_TYPE_EXPANSIONS",
    () => MAX_TEMPLATE_TYPE_EXPANSIONS,
    (value) => {
      MAX_TEMPLATE_TYPE_EXPANSIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_ENUM_CONTROL_OPTIONS",
    () => MAX_ENUM_CONTROL_OPTIONS,
    (value) => {
      MAX_ENUM_CONTROL_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_NUMERIC_ENUM_OPTIONS",
    () => MIN_NUMERIC_ENUM_OPTIONS,
    (value) => {
      MIN_NUMERIC_ENUM_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NON_EDITABLE_REACT_TYPES",
    () => NON_EDITABLE_REACT_TYPES,
    (value) => {
      NON_EDITABLE_REACT_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createTypeInferenceState",
    () => createTypeInferenceState,
  );
  bindRuntimeValue(
    runtime,
    "typeLiteralSets",
    () => typeLiteralSets,
    (value) => {
      typeLiteralSets = value;
    },
  );
  bindRuntimeValue(runtime, "appendTypeLiteral", () => appendTypeLiteral);
  bindRuntimeValue(runtime, "mergeInferredControl", () => mergeInferredControl);
  bindRuntimeValue(
    runtime,
    "TypeDeclarationResolver",
    () => TypeDeclarationResolver,
    (value) => {
      TypeDeclarationResolver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "enumControlFromLiterals",
    () => enumControlFromLiterals,
  );
  bindRuntimeValue(runtime, "inferEnumDeclaration", () => inferEnumDeclaration);
  bindRuntimeValue(
    runtime,
    "arrayElementTypeExpression",
    () => arrayElementTypeExpression,
  );
  bindRuntimeValue(runtime, "stripTypeComments", () => stripTypeComments);
  bindRuntimeValue(runtime, "unwrapTypeExpression", () => unwrapTypeExpression);
  bindRuntimeValue(
    runtime,
    "conciseTypeDescription",
    () => conciseTypeDescription,
  );
  bindRuntimeValue(runtime, "splitTypeExpression", () => splitTypeExpression);
  bindRuntimeValue(
    runtime,
    "inferVariantPropsType",
    () => inferVariantPropsType,
  );
  bindRuntimeValue(runtime, "parseJSDocDefault", () => parseJSDocDefault);
  bindRuntimeValue(
    runtime,
    "OMITTED_COMPONENT_PROPS",
    () => OMITTED_COMPONENT_PROPS,
    (value) => {
      OMITTED_COMPONENT_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cachedTypeDeclarationResolver",
    () => cachedTypeDeclarationResolver,
    (value) => {
      cachedTypeDeclarationResolver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typeInferenceIncomplete",
    () => typeInferenceIncomplete,
    (value) => {
      typeInferenceIncomplete = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "wasTypeInferenceIncomplete",
    () => wasTypeInferenceIncomplete,
  );
  bindRuntimeValue(
    runtime,
    "getTypeDeclarationResolver",
    () => getTypeDeclarationResolver,
  );
  bindRuntimeValue(
    runtime,
    "inferComponentPropControls",
    () => inferComponentPropControls,
  );
  bindRuntimeValue(runtime, "jsonForInlineScript", () => jsonForInlineScript);
  bindRuntimeValue(
    runtime,
    "generateComponentMountHtml",
    () => generateComponentMountHtml,
  );
  bindRuntimeValue(runtime, "escapeHtmlAttribute", () => escapeHtmlAttribute);
  return () => {
    DEFAULT_COMPONENT_PREVIEW_HEIGHT = 120;
    MAX_COMPONENT_GROUP_LABEL_LENGTH = 64;
    COMPONENT_CARD_HEADER_PATTERN =
      /^[ \t]*<\!--\s*@dsCard\b((?:(?!--)[^\r\n])*)(?:[\r\n]\s*)?-->/;
    COMPONENT_CARD_ATTRIBUTE_PATTERN =
      /([A-Za-z][A-Za-z0-9_-]*)(?:\s*=\s*(?:"([^"]*)"|([^\s"'<>=]+)))?/g;
    NUMERIC_TOKEN_SUFFIX_PATTERN = /^(.*?)-\d{1,4}$/;
    TOKEN_NAME_SEPARATOR = "-";
    PALETTE_GROUP_NAME = "Palette";
    MAX_INFERRED_COMPONENT_PROPS = 24;
    MAX_REFERENCED_TYPE_NAMES = 32;
    MAX_TYPE_BODY_MEMBERS = 2000;
    MAX_TYPE_INFERENCE_WORK = 50000;
    MAX_TYPE_INFERENCE_SCANNED_CHARACTERS = 268435456;
    TYPE_INFERENCE_OVER_BUDGET = Symbol("over budget");
    MAX_PROPS_INHERITANCE_DEPTH = 4;
    TYPE_IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;
    QUOTED_TYPE_LITERAL_PATTERN = /^(?:"([^"\\]*)"|'([^'\\]*)')$/;
    NUMERIC_TYPE_LITERAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
    MAX_TYPE_RESOLUTION_DEPTH = 12;
    MAX_TEMPLATE_TYPE_EXPANSIONS = 64;
    MAX_ENUM_CONTROL_OPTIONS = 400;
    MIN_NUMERIC_ENUM_OPTIONS = 3;
    NON_EDITABLE_REACT_TYPES = new Set([
      "ReactElement",
      "JSX.Element",
      "Element",
      "HTMLElement",
      "ComponentType",
      "FC",
      "FunctionComponent",
      "ElementType",
      "Ref",
      "RefObject",
      "CSSProperties",
    ]);
    typeLiteralSets = new WeakMap();
    TypeDeclarationResolver = class TypeDeclarationResolver {
      readonly texts: readonly string[];
      decls = new Map<string, M.TypeDeclaration | null>();
      named = new Map<string, M.InferredControl | null>();
      busy = new Set<string>();
      readonly textBytes: number;
      constructor(texts: readonly string[]) {
        this.texts = texts;
        this.textBytes = texts.reduce(
          (input, items) => input + items.length,
          0,
        );
      }
      work = 0;
      scanned = 0;
      reuse() {
        this.work = 0;
        this.scanned = 0;
        this.busy.clear();
        this.named.clear();
        return this;
      }
      tick(units = 1): void {
        if ((this.work += units) > MAX_TYPE_INFERENCE_WORK) {
          throw TYPE_INFERENCE_OVER_BUDGET;
        }
      }
      charge(characters: number): void {
        if (
          (this.scanned += characters) > MAX_TYPE_INFERENCE_SCANNED_CHARACTERS
        ) {
          throw TYPE_INFERENCE_OVER_BUDGET;
        }
      }
      headBodies = new Map<string, string[]>();
      heads(typeText: string): string[] {
        let cached = this.headBodies.get(typeText);
        if (cached === undefined) {
          this.charge(typeText.length);
          cached = inlineTypeObjectBodies(typeText);
          this.headBodies.set(typeText, cached);
        }
        this.tick();
        return cached;
      }
      bodies = new Map<string, M.TypeBodyMember[]>();
      members(body: string): M.TypeBodyMember[] {
        let members = this.bodies.get(body);
        if (members === undefined) {
          this.charge(body.length);
          members = parseTypeBodyMembers(body);
          this.bodies.set(body, members);
        }
        this.tick(1 + (members.length >> 4));
        return members;
      }
      decl(name: string): M.TypeDeclaration | null {
        let cached = this.decls.get(name);
        if (cached !== undefined) {
          return cached;
        }
        this.tick(25);
        this.charge(this.textBytes);
        let declaration = findTypeDeclaration(this.texts, name);
        this.decls.set(name, declaration);
        return declaration;
      }
      resolve(typeText: string, depth: number): M.InferredControl | null {
        this.tick();
        let state = createTypeInferenceState();
        this.arms(typeText, depth, state);
        return this.control(state, typeText);
      }
      resolveName(name: string, depth: number): M.InferredControl | null {
        let cached = this.named.get(name);
        if (cached !== undefined) {
          return cached;
        }
        if (this.busy.has(name) || depth > MAX_TYPE_RESOLUTION_DEPTH) {
          return {
            kind: "string",
            typeName: name,
          };
        }
        this.busy.add(name);
        let control: M.InferredControl | null,
          declaration = this.decl(name);
        if (declaration === null) {
          control = NON_EDITABLE_REACT_TYPES.has(name)
            ? null
            : {
                kind: "string",
                typeName: name,
              };
        } else if (declaration.kind === "type") {
          control = this.resolve(declaration.head, depth + 1);
          if (
            control !== null &&
            control.kind === "string" &&
            control.typeName !== undefined &&
            this.decl(control.typeName) === null
          ) {
            control = {
              kind: "string",
              typeName: name,
            };
          }
        } else if (declaration.kind === "enum") {
          control = inferEnumDeclaration(declaration.body);
        } else {
          control = null;
        }
        this.busy.delete(name);
        this.named.set(name, control);
        return control;
      }
      arms(typeText: string, depth: number, state: M.TypeInferenceState): void {
        this.charge(typeText.length);
        for (let value of splitTypeExpression(
          stripTypeComments(typeText),
          "|",
        )) {
          this.tick();
          this.charge(value.length);
          let value2 = unwrapTypeExpression(value);
          if (
            value2 === "" ||
            value2 === "undefined" ||
            value2 === "null" ||
            value2 === "never"
          ) {
            continue;
          }
          let value3 = QUOTED_TYPE_LITERAL_PATTERN.exec(value2);
          if (value3 !== null) {
            appendTypeLiteral(state, value3[1] ?? value3[2] ?? "", true);
            continue;
          }
          if (NUMERIC_TYPE_LITERAL_PATTERN.test(value2)) {
            appendTypeLiteral(state, value2);
            continue;
          }
          if (value2 === "boolean" || value2 === "true" || value2 === "false") {
            state.bool = true;
            continue;
          }
          if (value2 === "number") {
            state.num = true;
            continue;
          }
          if (value2 === "string") {
            state.str = true;
            continue;
          }
          if (value2 === "ReactNode" || value2 === "React.ReactNode") {
            state.node = true;
            continue;
          }
          if (value2.startsWith("`") && value2.endsWith("`")) {
            let value5 = this.template(value2.slice(1, -1), depth);
            if (value5 === null) {
              state.str = true;
            } else {
              for (let value6 of value5) {
                appendTypeLiteral(state, value6);
              }
            }
            continue;
          }
          let value4 = this.special(value2, depth);
          if (value4 !== undefined) {
            mergeInferredControl(state, value4);
            continue;
          }
          if (TYPE_IDENTIFIER_PATTERN.test(value2)) {
            mergeInferredControl(state, this.resolveName(value2, depth));
            continue;
          }
          state.other = true;
        }
      }
      special(
        typeText: string,
        depth: number,
      ): M.InferredControl | null | undefined {
        let generic = /^([A-Za-z_$][\w$]*)\s*<([\s\S]*)>$/.exec(typeText);
        if (generic !== null) {
          if (depth > MAX_TYPE_RESOLUTION_DEPTH) {
            return null;
          }
          let value = generic[1] ?? "",
            value2 = splitTypeExpression(generic[2] ?? "", ",");
          if (value === "NonNullable" && value2.length === 1) {
            return this.resolve(value2[0] ?? "", depth + 1);
          }
          if (
            (value === "Extract" || value === "Exclude") &&
            value2.length === 2
          ) {
            return this.extract(
              value === "Extract",
              value2[0] ?? "",
              value2[1] ?? "",
              depth,
            );
          }
          return null;
        }
        let variantType = inferVariantPropsType(typeText, this);
        if (variantType !== null) {
          return this.resolve(variantType, depth + 1);
        }
        let keyofMatch = /^keyof\s+(typeof\s+)?([A-Za-z_$][\w$]*)$/.exec(
          typeText,
        );
        if (keyofMatch !== null) {
          let value = this.keysOf(
            keyofMatch[2] ?? "",
            keyofMatch[1] !== undefined,
            depth,
          );
          if (value === null) {
            return null;
          } else {
            return enumControlFromLiterals(value);
          }
        }
        let arrayMatch =
          /^\(?\s*typeof\s+([A-Za-z_$][\w$]*)\s*\)?\s*\[\s*number\s*\]$/.exec(
            typeText,
          );
        if (arrayMatch !== null) {
          let value = this.decl(arrayMatch[1] ?? "");
          if (value === null || value.kind !== "const") {
            return null;
          }
          this.charge(value.head.length);
          return this.resolve(
            arrayElementTypeExpression(value.head),
            depth + 1,
          );
        }
        let memberMatch =
          /^([A-Za-z_$][\w$]*)\s*\[\s*(?:"([^"]+)"|'([^']+)')\s*\]$/.exec(
            typeText,
          );
        if (memberMatch !== null) {
          let value = this.memberType(
            memberMatch[1] ?? "",
            memberMatch[2] ?? memberMatch[3] ?? "",
            depth,
          );
          if (value === null) {
            return null;
          } else {
            return this.resolve(value, depth + 1);
          }
        }
        if (typeText.startsWith("typeof ")) {
          return null;
        }
        return;
      }
      extract(
        isExtract: boolean,
        sourceType: string,
        filterType: string,
        depth: number,
      ) {
        let filterState = createTypeInferenceState();
        this.arms(filterType, depth + 1, filterState);
        let sourceState = createTypeInferenceState();
        this.arms(sourceType, depth + 1, sourceState);
        if (isExtract) {
          if (
            sourceState.literals.length === 0 &&
            !sourceState.str &&
            !sourceState.num &&
            !sourceState.bool &&
            filterState.literals.length > 0 &&
            !filterState.str
          ) {
            return enumControlFromLiterals(filterState.literals);
          }
          let state = {
            ...createTypeInferenceState(),
            literals: filterState.str
              ? sourceState.literals
              : sourceState.literals.filter((input) =>
                  filterState.literals.includes(input),
                ),
          };
          state.numeric = state.literals.every((input) =>
            NUMERIC_TYPE_LITERAL_PATTERN.test(input),
          );
          state.str = sourceState.str && filterState.str;
          state.num = sourceState.num && filterState.num;
          state.bool = sourceState.bool && filterState.bool;
          state.node = sourceState.node && filterState.node;
          return this.control(state, sourceType);
        }
        let excluded = {
          ...sourceState,
          literals: sourceState.literals.filter(
            (input): boolean => !filterState.literals.includes(input),
          ),
          unresolved: [...sourceState.unresolved],
        };
        if (filterState.str) {
          excluded.literals = [];
        }
        excluded.numeric = excluded.literals.every((input) =>
          NUMERIC_TYPE_LITERAL_PATTERN.test(input),
        );
        if (filterState.bool) {
          excluded.bool = false;
        }
        if (filterState.num) {
          excluded.num = false;
        }
        if (filterState.str) {
          excluded.str = false;
        }
        return this.control(excluded, sourceType);
      }
      keysOf(name: string, isTypeof: boolean, depth: number): string[] | null {
        if (depth > MAX_TYPE_RESOLUTION_DEPTH) {
          return null;
        }
        let declaration = this.decl(name);
        if (declaration === null) {
          return null;
        }
        if (isTypeof) {
          if (declaration.kind !== "const") {
            return null;
          }
          let value = this.heads(declaration.head);
          if (value.length === 0) {
            return null;
          } else {
            return this.members(value[0] ?? "").map((input) => input.name);
          }
        }
        if (declaration.kind === "interface") {
          return this.members(declaration.body).map((input) => input.name);
        }
        if (declaration.kind !== "type") {
          return null;
        }
        this.charge(declaration.head.length);
        let head = unwrapTypeExpression(stripTypeComments(declaration.head)),
          typeOfMatch = /^typeof\s+([A-Za-z_$][\w$]*)$/.exec(head);
        if (typeOfMatch !== null) {
          return this.keysOf(typeOfMatch[1] ?? "", true, depth + 1);
        }
        if (TYPE_IDENTIFIER_PATTERN.test(head)) {
          return this.keysOf(head, false, depth + 1);
        }
        let bodies = this.heads(head);
        if (bodies.length === 0) {
          return null;
        } else {
          return this.members(bodies[0] ?? "").map((input) => input.name);
        }
      }
      memberType(name: string, property: string, depth: number): string | null {
        if (depth > MAX_TYPE_RESOLUTION_DEPTH) {
          return null;
        }
        let declaration = this.decl(name);
        if (declaration === null || declaration.kind === "enum") {
          return null;
        }
        let bodies =
          declaration.kind === "interface"
            ? [declaration.body]
            : this.heads(declaration.head);
        for (let value of bodies) {
          for (let value2 of this.members(value)) {
            if (value2.name === property) {
              return value2.type;
            }
          }
        }
        if (declaration.kind === "type") {
          this.charge(declaration.head.length);
          let value = unwrapTypeExpression(stripTypeComments(declaration.head));
          if (TYPE_IDENTIFIER_PATTERN.test(value)) {
            return this.memberType(value, property, depth + 1);
          }
        }
        return null;
      }
      template(templateText: string, depth: number): string[] | null {
        let expansions = [""],
          offset = 0;
        while (offset < templateText.length) {
          let value = templateText.indexOf("${", offset);
          if (value === -1) {
            let value6 = templateText.slice(offset);
            expansions = expansions.map((input) => input + value6);
            break;
          }
          let value2 = templateText.slice(offset, value),
            value3 = skipBalancedTypeExpression(templateText, value + 1);
          if (value3 === -1) {
            return null;
          }
          let value4 = this.resolve(
            templateText.slice(value + 2, value3 - 1),
            depth + 1,
          );
          if (value4 === null || value4.kind !== "enum") {
            return null;
          }
          let value5 = value4.options ?? [];
          if (
            expansions.length * value5.length >
            MAX_TEMPLATE_TYPE_EXPANSIONS
          ) {
            return null;
          }
          expansions = expansions.flatMap((input) =>
            value5.map((input2) => input + value2 + input2),
          );
          offset = value3;
        }
        return expansions;
      }
      control(
        state: M.TypeInferenceState,
        typeText: string,
      ): M.InferredControl | null {
        let literals = state.literals,
          hasStringOrNode = state.str || state.node;
        if (literals.length > 0 && !hasStringOrNode) {
          if (state.num && literals.length < MIN_NUMERIC_ENUM_OPTIONS) {
            return {
              kind: "string",
              typeName: conciseTypeDescription(typeText),
            };
          }
          if (literals.length > MAX_ENUM_CONTROL_OPTIONS) {
            return {
              kind: "string",
              typeName: conciseTypeDescription(typeText),
            };
          }
          let state2: M.InferredControl = {
            kind: "enum",
            options: state.bool ? ["true", "false", ...literals] : literals,
          };
          if (state.bool) {
            state2.withBool = true;
          } else if (state.numeric) {
            state2.numeric = true;
          }
          return state2;
        }
        if (hasStringOrNode) {
          if (!state.str && state.other && state.unresolved.length === 0) {
            return {
              kind: "string",
              typeName: "ReactNode",
            };
          }
          if (state.unresolved.length > 0) {
            return {
              kind: "string",
              typeName: state.unresolved[0],
            };
          } else {
            return {
              kind: "string",
            };
          }
        }
        if (state.num && !state.bool) {
          return {
            kind: "number",
          };
        }
        if (state.bool && !state.num) {
          return {
            kind: "boolean",
          };
        }
        if (state.num && state.bool) {
          return {
            kind: "string",
            typeName: conciseTypeDescription(typeText),
          };
        }
        if (state.unresolved.length > 0) {
          return {
            kind: "string",
            typeName: state.unresolved[0],
          };
        }
        return null;
      }
    };
    OMITTED_COMPONENT_PROPS = new Set([
      "ref",
      "key",
      "render",
      "style",
      "className",
      "id",
      "tabIndex",
      "role",
      "name",
      "form",
      "type",
      "value",
      "defaultValue",
      "suppressHydrationWarning",
    ]);
    cachedTypeDeclarationResolver = null;
    typeInferenceIncomplete = false;
  };
}
