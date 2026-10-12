/** Component prop discovery worker restored from the design artifact. */

export type PropertyValue = string | number | boolean;
export interface ResolvedControl {
  kind: "string" | "number" | "boolean" | "enum";
  options?: string[];
  numeric?: boolean;
  withBool?: boolean;
  typeName?: string;
}
export interface PropertySpec extends ResolvedControl {
  name: string;
  required?: boolean;
  default?: PropertyValue;
}
interface Declaration {
  kind: "interface" | "type" | "const" | "enum";
  head: string;
  body: string;
}
interface TypeMember {
  name: string;
  optional: boolean;
  type: string;
  documentation: string;
}
interface UnionSummary {
  literals: string[];
  numeric: boolean;
  hasString: boolean;
  hasNumber: boolean;
  hasBoolean: boolean;
  hasReactNode: boolean;
  hasUnsupportedType: boolean;
  unresolvedTypes: string[];
}
export interface PropertyScrubberRequest {
  id: number;
  names: string[];
  texts: string[];
  keep?: string[];
}
export interface PropertyScrubberResponse {
  id: number;
  specs: PropertySpec[];
}
interface ExtractOptions {
  keep?: string[];
}
interface PropertyScrubberWorkerScope {
  onmessage: ((event: MessageEvent<PropertyScrubberRequest>) => void) | null;
  postMessage(message: PropertyScrubberResponse): void;
}

const workerScope = self as unknown as PropertyScrubberWorkerScope;
("use strict");

(() => {
  function decodeControlValue(
    control: ResolvedControl,
    option: string,
  ): PropertyValue {
    return control.numeric === true
      ? Number(option)
      : control.withBool === true && (option === "true" || option === "false")
        ? option === "true"
        : option;
  }
  let MAX_PROPERTIES = 24,
    MAX_BASE_TYPES = 32,
    MAX_MEMBERS = 2e3,
    MAX_RESOLUTION_WORK = 5e4,
    MAX_SCANNED_CHARACTERS = 256 * 1024 * 1024,
    BUDGET_EXCEEDED = Symbol("over budget"),
    MAX_INHERITANCE_DEPTH = 4,
    IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;
  function isValidComponentName(name: string): boolean {
    return IDENTIFIER_PATTERN.test(name) && name.length <= 80;
  }
  function findBalancedEnd(source: string, start: number): number {
    let opening = source[start],
      closing =
        opening === "{"
          ? "}"
          : opening === "("
            ? ")"
            : opening === "["
              ? "]"
              : ">",
      depth = 0;
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (character === '"' || character === "'" || character === "`") {
        const quote = character;
        for (index++; index < source.length && source[index] !== quote; ) {
          source[index] === "\\" && index++;
          index++;
        }
        continue;
      }
      if (character === "/" && source[index + 1] === "*") {
        const commentEnd = source.indexOf("*/", index + 2);
        if (commentEnd === -1) return -1;
        index = commentEnd + 1;
        continue;
      }
      if (character === "/" && source[index + 1] === "/") {
        const commentEnd = source.indexOf(
          `
`,
          index,
        );
        if (commentEnd === -1) return -1;
        index = commentEnd;
        continue;
      }
      if (character === opening) depth++;
      else if (character === closing && (depth--, depth === 0))
        return index + 1;
    }
    return -1;
  }
  function findStatementEnd(source: string, start: number): number {
    let index = start;
    for (; index < source.length; ) {
      const character = source[index];
      if (character === ";") return index;
      if (character === "{" || character === "(" || character === "[") {
        const balancedEnd = findBalancedEnd(source, index);
        if (balancedEnd === -1) return source.length;
        index = balancedEnd;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        const quote = character;
        for (index++; index < source.length && source[index] !== quote; ) {
          source[index] === "\\" && index++;
          index++;
        }
        index++;
        continue;
      }
      if (character === "/" && source[index + 1] === "*") {
        const commentEnd = source.indexOf("*/", index + 2);
        index = commentEnd === -1 ? source.length : commentEnd + 2;
        continue;
      }
      if (character === "/" && source[index + 1] === "/") {
        const commentEnd = source.indexOf(
          `
`,
          index,
        );
        index = commentEnd === -1 ? source.length : commentEnd + 1;
        continue;
      }
      index++;
    }
    return source.length;
  }
  function findNamedDeclaration(
    texts: string[],
    name: string,
  ): Declaration | null {
    for (let text of texts)
      for (let kind of ["interface", "type", "const", "enum"] as const) {
        let searchStart = 0,
          needle = kind + " " + name;
        for (;;) {
          const matchIndex = text.indexOf(needle, searchStart);
          if (matchIndex === -1) break;
          searchStart = matchIndex + needle.length;
          let precedingCharacter =
              matchIndex === 0 ? " " : (text[matchIndex - 1] ?? " "),
            followingCharacter = text[searchStart] ?? " ";
          if (
            /[\w$]/.test(precedingCharacter) ||
            /[\w$]/.test(followingCharacter)
          )
            continue;
          if (kind === "interface" || kind === "enum") {
            const bodyStart = text.indexOf("{", searchStart);
            if (bodyStart === -1) break;
            const bodyEnd = findBalancedEnd(text, bodyStart);
            if (bodyEnd === -1) break;
            return {
              kind: kind,
              head: text.slice(searchStart, bodyStart),
              body: text.slice(bodyStart + 1, bodyEnd - 1),
            };
          }
          let remainder = text
              .slice(searchStart)
              .replace(/^\s*(?:<[^=]*>\s*)?[=:]\s*/, ""),
            removedPrefixLength = text.length - searchStart - remainder.length,
            valueStart = searchStart + removedPrefixLength,
            valueEnd = findStatementEnd(text, valueStart);
          return {
            kind: kind,
            head: text.slice(valueStart, valueEnd),
            body: "",
          };
        }
      }
    return null;
  }
  function parseMembers(body: string): TypeMember[] {
    let members: TypeMember[] = [],
      index = 0,
      documentation = "";
    for (; index < body.length && members.length < MAX_MEMBERS; ) {
      const character = body[index];
      if (
        character === " " ||
        character ===
          `
` ||
        character === "	" ||
        character === "\r"
      ) {
        index++;
        continue;
      }
      if (character === "/" && body[index + 1] === "*") {
        let commentEnd = body.indexOf("*/", index + 2),
          comment = body.slice(
            index,
            commentEnd === -1 ? body.length : commentEnd + 2,
          );
        documentation = comment.startsWith("/**") ? comment : "";
        index = commentEnd === -1 ? body.length : commentEnd + 2;
        continue;
      }
      if (character === "/" && body[index + 1] === "/") {
        const commentEnd = body.indexOf(
          `
`,
          index,
        );
        index = commentEnd === -1 ? body.length : commentEnd + 1;
        continue;
      }
      let statementEnd = findStatementEnd(body, index),
        statement = body.slice(index, statementEnd);
      index = statementEnd + 1;
      const match =
        /^\s*(?:readonly\s+)?(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))(?:\s*(\?))?\s*:\s*([\s\S]+)$/.exec(
          statement,
        );
      if (match !== null) {
        const name = match[1] ?? match[2] ?? match[3] ?? "";
        members.push({
          name: name,
          optional: match[4] !== void 0,
          type: (match[5] ?? "").trim(),
          documentation: documentation,
        });
      }
      documentation = "";
    }
    return members;
  }
  function findBaseTypeNames(head: string): string[] {
    let withoutBodies = "",
      index = 0;
    for (; index < head.length; ) {
      if (head[index] === "{") {
        const bodyEnd = findBalancedEnd(head, index);
        if (bodyEnd === -1) break;
        index = bodyEnd;
        continue;
      }
      withoutBodies += head[index];
      index++;
    }
    let names: string[] = [],
      pattern = /\b([A-Z][\w$]*)\b(\s*\[)?/g,
      match;
    for (; (match = pattern.exec(withoutBodies)) !== null; ) {
      const name = match[1] ?? "";
      if (
        match[2] === void 0 &&
        !(
          name === "Omit" ||
          name === "Pick" ||
          name === "Partial" ||
          name === "Required" ||
          name === "NonNullable" ||
          name === "Readonly" ||
          name === "React"
        ) &&
        (names.includes(name) || names.push(name),
        names.length >= MAX_BASE_TYPES)
      )
        break;
    }
    return names;
  }
  function extractObjectBodies(head: string): string[] {
    let bodies: string[] = [],
      index = 0;
    for (; index < head.length; ) {
      const character = head[index];
      if (character === "{") {
        const bodyEnd = findBalancedEnd(head, index);
        if (bodyEnd === -1) break;
        bodies.push(head.slice(index + 1, bodyEnd - 1));
        index = bodyEnd;
        continue;
      }
      if (character === "(" || character === "[") {
        index++;
        continue;
      }
      if (character === "<") {
        const genericEnd = findBalancedEnd(head, index);
        index = genericEnd === -1 ? head.length : genericEnd;
        continue;
      }
      index++;
    }
    return bodies;
  }
  let STRING_LITERAL_PATTERN = /^(?:"([^"\\]*)"|'([^'\\]*)')$/,
    NUMBER_LITERAL_PATTERN = /^-?\d+(?:\.\d+)?$/,
    MAX_TYPE_DEPTH = 12,
    MAX_TEMPLATE_OPTIONS = 64,
    MAX_ENUM_OPTIONS = 400,
    MIN_NUMBER_UNION_OPTIONS = 3,
    UNSUPPORTED_REACT_TYPES = new Set([
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
  function createUnionSummary(): UnionSummary {
    return {
      literals: [],
      numeric: true,
      hasString: false,
      hasNumber: false,
      hasBoolean: false,
      hasReactNode: false,
      hasUnsupportedType: false,
      unresolvedTypes: [],
    };
  }
  const literalSets: WeakMap<string[], Set<string>> = new WeakMap();
  function appendLiteral(
    summary: UnionSummary,
    literal: string,
    isStringLiteral: boolean = false,
  ): void {
    let seen = literalSets.get(summary.literals);
    seen === void 0 &&
      literalSets.set(summary.literals, (seen = new Set(summary.literals)));
    !(seen.size > MAX_ENUM_OPTIONS) &&
      (seen.has(literal) || (seen.add(literal), summary.literals.push(literal)),
      (isStringLiteral || !NUMBER_LITERAL_PATTERN.test(literal)) &&
        (summary.numeric = false));
  }
  function mergeResolvedControl(
    summary: UnionSummary,
    control: ResolvedControl | null,
  ): void {
    if (control === null) {
      summary.hasUnsupportedType = true;
      return;
    }
    if (control.kind === "enum") {
      const options = control.options ?? [];
      control.withBool === true && (summary.hasBoolean = true);
      for (let option of control.withBool === true ? options.slice(2) : options)
        appendLiteral(summary, option);
      control.numeric !== true && (summary.numeric = false);
    } else
      control.kind === "boolean"
        ? (summary.hasBoolean = true)
        : control.kind === "number"
          ? (summary.hasNumber = true)
          : ((summary.hasString = true),
            control.typeName !== void 0 &&
              summary.unresolvedTypes.push(control.typeName));
  }
  class PropertyTypeResolver {
    constructor(texts: string[]) {
      this.texts = texts;
      this.textCharacters = texts.reduce(
        (total, text) => total + text.length,
        0,
      );
    }
    texts: string[];
    declarations: Map<string, Declaration | null> = new Map();
    resolvedNames: Map<string, ResolvedControl | null> = new Map();
    resolvingNames: Set<string> = new Set();
    textCharacters: number;
    resolutionWork = 0;
    scannedCharacters = 0;
    resetWorkBudget(): this {
      this.resolutionWork = 0;
      this.scannedCharacters = 0;
      this.resolvingNames.clear();
      this.resolvedNames.clear();
      return this;
    }
    spendWork(amount: number = 1): void {
      if ((this.resolutionWork += amount) > MAX_RESOLUTION_WORK)
        throw BUDGET_EXCEEDED;
    }
    scanCharacters(characters: number): void {
      if ((this.scannedCharacters += characters) > MAX_SCANNED_CHARACTERS)
        throw BUDGET_EXCEEDED;
    }
    objectBodies: Map<string, string[]> = new Map();
    getObjectBodies(head: string): string[] {
      let bodies = this.objectBodies.get(head);
      bodies === void 0 &&
        (this.scanCharacters(head.length),
        (bodies = extractObjectBodies(head)),
        this.objectBodies.set(head, bodies));
      this.spendWork();
      return bodies;
    }
    parsedMembers: Map<string, TypeMember[]> = new Map();
    getMembers(body: string): TypeMember[] {
      let members = this.parsedMembers.get(body);
      members === void 0 &&
        (this.scanCharacters(body.length),
        (members = parseMembers(body)),
        this.parsedMembers.set(body, members));
      this.spendWork(1 + (members.length >> 4));
      return members;
    }
    getDeclaration(name: string): Declaration | null {
      const cached = this.declarations.get(name);
      if (cached !== void 0) return cached;
      this.spendWork(25);
      this.scanCharacters(this.textCharacters);
      const declaration = findNamedDeclaration(this.texts, name);
      this.declarations.set(name, declaration);
      return declaration;
    }
    resolveType(type: string, depth: number): ResolvedControl | null {
      this.spendWork();
      const summary = createUnionSummary();
      this.collectUnionArms(type, depth, summary);
      return this.summarizeControl(summary, type);
    }
    resolveNamedType(name: string, depth: number): ResolvedControl | null {
      const cached = this.resolvedNames.get(name);
      if (cached !== void 0) return cached;
      if (this.resolvingNames.has(name) || depth > MAX_TYPE_DEPTH)
        return {
          kind: "string",
          typeName: name,
        };
      this.resolvingNames.add(name);
      let control: ResolvedControl | null,
        declaration = this.getDeclaration(name);
      declaration === null
        ? (control = UNSUPPORTED_REACT_TYPES.has(name)
            ? null
            : {
                kind: "string",
                typeName: name,
              })
        : declaration.kind === "type"
          ? ((control = this.resolveType(declaration.head, depth + 1)),
            control !== null &&
              control.kind === "string" &&
              control.typeName !== void 0 &&
              this.getDeclaration(control.typeName) === null &&
              (control = {
                kind: "string",
                typeName: name,
              }))
          : declaration.kind === "enum"
            ? (control = parseEnumControl(declaration.body))
            : (control = null);
      this.resolvingNames.delete(name);
      this.resolvedNames.set(name, control);
      return control;
    }
    collectUnionArms(type: string, depth: number, summary: UnionSummary): void {
      this.scanCharacters(type.length);
      for (let arm of splitTopLevel(stripBlockComments(type), "|")) {
        this.spendWork();
        this.scanCharacters(arm.length);
        const typeArm = unwrapParentheses(arm);
        if (
          typeArm === "" ||
          typeArm === "undefined" ||
          typeArm === "null" ||
          typeArm === "never"
        )
          continue;
        const stringMatch = STRING_LITERAL_PATTERN.exec(typeArm);
        if (stringMatch !== null) {
          appendLiteral(summary, stringMatch[1] ?? stringMatch[2] ?? "", true);
          continue;
        }
        if (NUMBER_LITERAL_PATTERN.test(typeArm)) {
          appendLiteral(summary, typeArm);
          continue;
        }
        if (
          typeArm === "boolean" ||
          typeArm === "true" ||
          typeArm === "false"
        ) {
          summary.hasBoolean = true;
          continue;
        }
        if (typeArm === "number") {
          summary.hasNumber = true;
          continue;
        }
        if (typeArm === "string") {
          summary.hasString = true;
          continue;
        }
        if (typeArm === "ReactNode" || typeArm === "React.ReactNode") {
          summary.hasReactNode = true;
          continue;
        }
        if (typeArm.startsWith("`") && typeArm.endsWith("`")) {
          const options = this.expandTemplateLiteral(
            typeArm.slice(1, -1),
            depth,
          );
          if (options === null) summary.hasString = true;
          else for (let option of options) appendLiteral(summary, option);
          continue;
        }
        const specialControl = this.resolveSpecialType(typeArm, depth);
        if (specialControl !== void 0) {
          mergeResolvedControl(summary, specialControl);
          continue;
        }
        if (IDENTIFIER_PATTERN.test(typeArm)) {
          mergeResolvedControl(summary, this.resolveNamedType(typeArm, depth));
          continue;
        }
        summary.hasUnsupportedType = true;
      }
    }
    resolveSpecialType(
      type: string,
      depth: number,
    ): ResolvedControl | null | undefined {
      const genericMatch = /^([A-Za-z_$][\w$]*)\s*<([\s\S]*)>$/.exec(type);
      if (genericMatch !== null) {
        if (depth > MAX_TYPE_DEPTH) return null;
        let genericName = genericMatch[1] ?? "",
          argumentsList = splitTopLevel(genericMatch[2] ?? "", ",");
        return genericName === "NonNullable" && argumentsList.length === 1
          ? this.resolveType(argumentsList[0] ?? "", depth + 1)
          : (genericName === "Extract" || genericName === "Exclude") &&
              argumentsList.length === 2
            ? this.resolveExtractOrExclude(
                genericName === "Extract",
                argumentsList[0] ?? "",
                argumentsList[1] ?? "",
                depth,
              )
            : null;
      }
      const variantType = findVariantPropertyType(type, this);
      if (variantType !== null) return this.resolveType(variantType, depth + 1);
      const keyofMatch = /^keyof\s+(typeof\s+)?([A-Za-z_$][\w$]*)$/.exec(type);
      if (keyofMatch !== null) {
        const keys = this.resolveKeys(
          keyofMatch[2] ?? "",
          keyofMatch[1] !== void 0,
          depth,
        );
        return keys === null ? null : createEnumControl(keys);
      }
      const arrayIndexMatch =
        /^\(?\s*typeof\s+([A-Za-z_$][\w$]*)\s*\)?\s*\[\s*number\s*\]$/.exec(
          type,
        );
      if (arrayIndexMatch !== null) {
        const declaration = this.getDeclaration(arrayIndexMatch[1] ?? "");
        return declaration === null || declaration.kind !== "const"
          ? null
          : (this.scanCharacters(declaration.head.length),
            this.resolveType(
              unwrapArrayElementType(declaration.head),
              depth + 1,
            ));
      }
      const memberIndexMatch =
        /^([A-Za-z_$][\w$]*)\s*\[\s*(?:"([^"]+)"|'([^']+)')\s*\]$/.exec(type);
      if (memberIndexMatch !== null) {
        const memberType = this.resolveMemberType(
          memberIndexMatch[1] ?? "",
          memberIndexMatch[2] ?? memberIndexMatch[3] ?? "",
          depth,
        );
        return memberType === null
          ? null
          : this.resolveType(memberType, depth + 1);
      }
      if (type.startsWith("typeof ")) return null;
    }
    resolveExtractOrExclude(
      isExtract: boolean,
      sourceType: string,
      filterType: string,
      depth: number,
    ): ResolvedControl | null {
      const filterSummary = createUnionSummary();
      this.collectUnionArms(filterType, depth + 1, filterSummary);
      const sourceSummary = createUnionSummary();
      if (
        (this.collectUnionArms(sourceType, depth + 1, sourceSummary), isExtract)
      ) {
        if (
          sourceSummary.literals.length === 0 &&
          !sourceSummary.hasString &&
          !sourceSummary.hasNumber &&
          !sourceSummary.hasBoolean &&
          filterSummary.literals.length > 0 &&
          !filterSummary.hasString
        )
          return createEnumControl(filterSummary.literals);
        const intersection = {
          ...createUnionSummary(),
          literals: filterSummary.hasString
            ? sourceSummary.literals
            : sourceSummary.literals.filter((literal) =>
                filterSummary.literals.includes(literal),
              ),
        };
        intersection.numeric = intersection.literals.every((literal) =>
          NUMBER_LITERAL_PATTERN.test(literal),
        );
        intersection.hasString =
          sourceSummary.hasString && filterSummary.hasString;
        intersection.hasNumber =
          sourceSummary.hasNumber && filterSummary.hasNumber;
        intersection.hasBoolean =
          sourceSummary.hasBoolean && filterSummary.hasBoolean;
        intersection.hasReactNode =
          sourceSummary.hasReactNode && filterSummary.hasReactNode;
        return this.summarizeControl(intersection, sourceType);
      }
      const remaining = {
        ...sourceSummary,
        literals: sourceSummary.literals.filter(
          (literal) => !filterSummary.literals.includes(literal),
        ),
        unresolvedTypes: [...sourceSummary.unresolvedTypes],
      };
      filterSummary.hasString && (remaining.literals = []);
      remaining.numeric = remaining.literals.every((literal) =>
        NUMBER_LITERAL_PATTERN.test(literal),
      );
      filterSummary.hasBoolean && (remaining.hasBoolean = false);
      filterSummary.hasNumber && (remaining.hasNumber = false);
      filterSummary.hasString && (remaining.hasString = false);
      return this.summarizeControl(remaining, sourceType);
    }
    resolveKeys(
      name: string,
      isTypeof: boolean,
      depth: number,
    ): string[] | null {
      if (depth > MAX_TYPE_DEPTH) return null;
      const declaration = this.getDeclaration(name);
      if (declaration === null) return null;
      if (isTypeof) {
        if (declaration.kind !== "const") return null;
        const bodies = this.getObjectBodies(declaration.head);
        return bodies.length === 0
          ? null
          : this.getMembers(bodies[0] ?? "").map((member) => member.name);
      }
      if (declaration.kind === "interface")
        return this.getMembers(declaration.body).map((member) => member.name);
      if (declaration.kind !== "type") return null;
      this.scanCharacters(declaration.head.length);
      let head = unwrapParentheses(stripBlockComments(declaration.head)),
        typeofMatch = /^typeof\s+([A-Za-z_$][\w$]*)$/.exec(head);
      if (typeofMatch !== null)
        return this.resolveKeys(typeofMatch[1] ?? "", true, depth + 1);
      if (IDENTIFIER_PATTERN.test(head))
        return this.resolveKeys(head, false, depth + 1);
      const bodies = this.getObjectBodies(head);
      return bodies.length === 0
        ? null
        : this.getMembers(bodies[0] ?? "").map((member) => member.name);
    }
    resolveMemberType(
      name: string,
      property: string,
      depth: number,
    ): string | null {
      if (depth > MAX_TYPE_DEPTH) return null;
      const declaration = this.getDeclaration(name);
      if (declaration === null || declaration.kind === "enum") return null;
      const bodies =
        declaration.kind === "interface"
          ? [declaration.body]
          : this.getObjectBodies(declaration.head);
      for (let body of bodies)
        for (let member of this.getMembers(body))
          if (member.name === property) return member.type;
      if (declaration.kind === "type") {
        this.scanCharacters(declaration.head.length);
        const head = unwrapParentheses(stripBlockComments(declaration.head));
        if (IDENTIFIER_PATTERN.test(head))
          return this.resolveMemberType(head, property, depth + 1);
      }
      return null;
    }
    expandTemplateLiteral(template: string, depth: number): string[] | null {
      let options = [""],
        index = 0;
      for (; index < template.length; ) {
        const placeholderStart = template.indexOf("${", index);
        if (placeholderStart === -1) {
          const suffix = template.slice(index);
          options = options.map((option) => option + suffix);
          break;
        }
        let prefix = template.slice(index, placeholderStart),
          placeholderEnd = findBalancedEnd(template, placeholderStart + 1);
        if (placeholderEnd === -1) return null;
        const control = this.resolveType(
          template.slice(placeholderStart + 2, placeholderEnd - 1),
          depth + 1,
        );
        if (control === null || control.kind !== "enum") return null;
        const values = control.options ?? [];
        if (options.length * values.length > MAX_TEMPLATE_OPTIONS) return null;
        options = options.flatMap((prefixOption) =>
          values.map((value) => prefixOption + prefix + value),
        );
        index = placeholderEnd;
      }
      return options;
    }
    summarizeControl(
      summary: UnionSummary,
      type: string,
    ): ResolvedControl | null {
      let literals = summary.literals,
        hasUnboundedString = summary.hasString || summary.hasReactNode;
      if (literals.length > 0 && !hasUnboundedString) {
        if (summary.hasNumber && literals.length < MIN_NUMBER_UNION_OPTIONS)
          return {
            kind: "string",
            typeName: describeType(type),
          };
        if (literals.length > MAX_ENUM_OPTIONS)
          return {
            kind: "string",
            typeName: describeType(type),
          };
        const control: ResolvedControl = {
          kind: "enum",
          options: summary.hasBoolean
            ? ["true", "false", ...literals]
            : literals,
        };
        summary.hasBoolean
          ? (control.withBool = true)
          : summary.numeric && (control.numeric = true);
        return control;
      }
      return hasUnboundedString
        ? !summary.hasString &&
          summary.hasUnsupportedType &&
          summary.unresolvedTypes.length === 0
          ? {
              kind: "string",
              typeName: "ReactNode",
            }
          : summary.unresolvedTypes.length > 0
            ? {
                kind: "string",
                typeName: summary.unresolvedTypes[0],
              }
            : {
                kind: "string",
              }
        : summary.hasNumber && !summary.hasBoolean
          ? {
              kind: "number",
            }
          : summary.hasBoolean && !summary.hasNumber
            ? {
                kind: "boolean",
              }
            : summary.hasNumber && summary.hasBoolean
              ? {
                  kind: "string",
                  typeName: describeType(type),
                }
              : summary.unresolvedTypes.length > 0
                ? {
                    kind: "string",
                    typeName: summary.unresolvedTypes[0],
                  }
                : null;
    }
  }
  function createEnumControl(options: string[]): ResolvedControl {
    const control: ResolvedControl = {
      kind: "enum",
      options: [...new Set(options)].slice(0, MAX_ENUM_OPTIONS + 1),
    };
    control.options !== void 0 &&
      control.options.length > 0 &&
      control.options.every((option) => NUMBER_LITERAL_PATTERN.test(option)) &&
      (control.numeric = true);
    return control;
  }
  function parseEnumControl(body: string): ResolvedControl | null {
    let options: string[] = [],
      numeric = true,
      nextValue = 0;
    for (let member of splitTopLevel(stripBlockComments(body), ",")) {
      const match =
        /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*(?:=([\s\S]*))?$/.exec(
          member.trim(),
        );
      if (match === null) continue;
      const initializer =
        match[4] === void 0 ? void 0 : match[4].trim() || void 0;
      if (initializer === void 0) {
        options.push(String(nextValue++));
        continue;
      }
      const stringMatch = STRING_LITERAL_PATTERN.exec(initializer);
      if (stringMatch !== null) {
        options.push(stringMatch[1] ?? stringMatch[2] ?? "");
        numeric = false;
        continue;
      }
      if (NUMBER_LITERAL_PATTERN.test(initializer)) {
        options.push(initializer);
        nextValue = Number(initializer) + 1;
        continue;
      }
      return null;
    }
    if (options.length === 0) return null;
    const control: ResolvedControl = {
      kind: "enum",
      options: options,
    };
    numeric && (control.numeric = true);
    return control;
  }
  function unwrapArrayElementType(type: string): string {
    const unwrapped = unwrapParentheses(stripBlockComments(type)).replace(
      /^readonly\s+/,
      "",
    );
    if (unwrapped.startsWith("[") && unwrapped.endsWith("]"))
      return splitTopLevel(unwrapped.slice(1, -1), ",").join(" | ");
    const arrayMatch = /^(?:ReadonlyArray|Array)\s*<([\s\S]*)>$/.exec(
      unwrapped,
    );
    return arrayMatch !== null
      ? (arrayMatch[1] ?? "")
      : unwrapped.endsWith("[]")
        ? unwrapped.slice(0, -2)
        : unwrapped;
  }
  function stripBlockComments(source: string): string {
    let result = "",
      segmentStart = 0,
      index = 0;
    for (; index < source.length; ) {
      const character = source[index];
      if (character === '"' || character === "'" || character === "`") {
        for (index++; index < source.length && source[index] !== character; )
          index += source[index] === "\\" ? 2 : 1;
        index++;
        continue;
      }
      if (character === "/" && source[index + 1] === "*") {
        result += source.slice(segmentStart, index);
        const commentEnd = source.indexOf("*/", index + 2);
        if (commentEnd === -1) return result.trim();
        index = segmentStart = commentEnd + 2;
        continue;
      }
      index++;
    }
    return (result + source.slice(segmentStart)).trim();
  }
  function unwrapParentheses(source: string): string {
    let unwrapped = source.trim();
    for (
      let depth = 0;
      depth < 8 &&
      unwrapped.startsWith("(") &&
      findBalancedEnd(unwrapped, 0) === unwrapped.length;
      depth++
    )
      unwrapped = unwrapped.slice(1, -1).trim();
    return unwrapped;
  }
  function describeType(type: string): string {
    const description = stripBlockComments(type).replace(/\s+/g, " ");
    return description.length > 40
      ? description.slice(0, 37) + "\u2026"
      : description;
  }
  function splitTopLevel(source: string, separator: string): string[] {
    let parts = [],
      depth = 0,
      segmentStart = 0,
      index = 0;
    for (; index < source.length; ) {
      const character = source[index];
      if (character === '"' || character === "'" || character === "`") {
        const quote = character;
        for (index++; index < source.length && source[index] !== quote; ) {
          source[index] === "\\" && index++;
          index++;
        }
        index++;
        continue;
      }
      character === "{" ||
      character === "(" ||
      character === "[" ||
      character === "<"
        ? depth++
        : character === "}" ||
            character === ")" ||
            character === "]" ||
            character === ">"
          ? (character === ">" && source[index - 1] === "=") || depth--
          : character === separator &&
            depth === 0 &&
            (parts.push(source.slice(segmentStart, index).trim()),
            (segmentStart = index + 1));
      index++;
    }
    parts.push(source.slice(segmentStart).trim());
    return parts.filter((part) => part !== "");
  }
  function findVariantPropertyType(
    type: string,
    resolver: PropertyTypeResolver,
  ): string | null {
    const match =
      /VariantProps<typeof\s+([A-Za-z_$][\w$]*)>\s*\[\s*"([^"]+)"\s*\]/.exec(
        type,
      );
    if (match === null) return null;
    const declaration = resolver.getDeclaration(match[1] ?? "");
    if (declaration === null) return null;
    const property = match[2] ?? "";
    for (let body of resolver.getObjectBodies(declaration.head))
      for (let member of resolver.getMembers(body))
        if (member.name === property) return member.type;
    return null;
  }
  function parseDefaultValue(
    documentation: string,
    control: ResolvedControl,
  ): PropertyValue | undefined {
    const match = /@default\s+(?:`([^`]*)`|"([^"]*)"|'([^']*)'|(\S+))/.exec(
      documentation,
    );
    if (match === null) return;
    const value = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").replace(
      /^["'`]|["'`]$/g,
      "",
    );
    if (control.kind === "boolean")
      return value === "true" ? true : value === "false" ? false : void 0;
    if (control.kind === "number") {
      const number = Number(value);
      return Number.isFinite(number) ? number : void 0;
    }
    return control.kind === "enum"
      ? control.options?.includes(value) !== true
        ? void 0
        : decodeControlValue(control, value)
      : value;
  }
  let IGNORED_PROPERTIES = new Set([
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
    ]),
    resolverCache: {
      texts: string[];
      resolver: PropertyTypeResolver;
    } | null = null,
    budgetExceeded = false;
  function getResolver(texts: string[]): PropertyTypeResolver {
    if (
      resolverCache !== null &&
      resolverCache.texts.length === texts.length &&
      resolverCache.texts.every((text, index) => text === texts[index])
    )
      return resolverCache.resolver.resetWorkBudget();
    const resolver = new PropertyTypeResolver(texts);
    resolverCache = {
      texts: texts,
      resolver: resolver,
    };
    return resolver;
  }
  function extractComponentProperties(
    componentName: string,
    texts: string[],
    options?: ExtractOptions,
  ): PropertySpec[] {
    budgetExceeded = false;
    const validTexts = texts.filter(
      (text) => typeof text == "string" && text !== "",
    );
    if (!isValidComponentName(componentName) || validTexts.length === 0)
      return [];
    let keep = new Set(options?.keep),
      properties: Map<string, PropertySpec> = new Map(),
      visited: Set<string> = new Set(),
      resolver = getResolver(validTexts),
      visit = (typeName: string, depth: number): void => {
        if (
          depth > MAX_INHERITANCE_DEPTH ||
          visited.has(typeName) ||
          properties.size >= MAX_PROPERTIES
        )
          return;
        visited.add(typeName);
        const declaration = resolver.getDeclaration(typeName);
        if (
          declaration === null ||
          declaration.kind === "const" ||
          declaration.kind === "enum"
        )
          return;
        const bodies =
          declaration.kind === "interface"
            ? [declaration.body]
            : resolver.getObjectBodies(declaration.head);
        for (let body of bodies)
          for (let member of resolver.getMembers(body)) {
            if ((resolver.spendWork(), properties.size >= MAX_PROPERTIES))
              break;
            if (
              (IGNORED_PROPERTIES.has(member.name) && !keep.has(member.name)) ||
              (member.name.startsWith("on") && /^on[A-Z]/.test(member.name)) ||
              /@deprecated\b/.test(member.documentation) ||
              /^\s*never\s*$/.test(member.type)
            )
              continue;
            const control = resolver.resolveType(member.type, 0);
            if (control === null) continue;
            const existing = properties.get(member.name);
            if (
              existing !== void 0 &&
              !(
                existing.kind === "string" &&
                existing.typeName !== void 0 &&
                control.kind !== "string"
              )
            )
              continue;
            const spec: PropertySpec = {
              name: member.name,
              kind: control.kind,
            };
            control.options !== void 0 && (spec.options = control.options);
            control.numeric === true && (spec.numeric = true);
            control.withBool === true && (spec.withBool = true);
            control.typeName !== void 0 && (spec.typeName = control.typeName);
            const defaultValue = parseDefaultValue(
              member.documentation,
              control,
            );
            defaultValue !== void 0 && (spec.default = defaultValue);
            member.optional || (spec.required = true);
            properties.set(member.name, spec);
          }
        resolver.scanCharacters(declaration.head.length);
        for (let baseType of findBaseTypeNames(declaration.head))
          visit(baseType, depth + 1);
      };
    try {
      visit(componentName + "Props", 0);
    } catch (error) {
      if (((resolverCache = null), error !== BUDGET_EXCEEDED)) throw error;
      budgetExceeded = true;
      return [];
    }
    const results = [...properties.values()];
    results.sort((first, second) =>
      first.name === "children" ? -1 : second.name === "children" ? 1 : 0,
    );
    return results;
  }
  function filterScrubbableProperties(
    properties: PropertySpec[],
  ): PropertySpec[] {
    return properties.filter(
      (property) =>
        property.name !== "children" &&
        /^[a-z_][\w.-]*$/.test(property.name) &&
        !(property.name in Object.prototype),
    );
  }
  function findScrubbableProperties(
    names: string[],
    texts: string[],
    keep?: string[],
  ): PropertySpec[] {
    try {
      for (let name of names) {
        const specs = filterScrubbableProperties(
          extractComponentProperties(name, texts, {
            keep: keep,
          }),
        );
        if (specs.length > 0) return specs;
      }
    } catch {}
    return [];
  }
  workerScope.onmessage = (event: MessageEvent<PropertyScrubberRequest>) => {
    let { id: id, names: names, texts: texts, keep: keep } = event.data;
    workerScope.postMessage({
      id: id,
      specs: findScrubbableProperties(names, texts, keep),
    });
  };
})();
