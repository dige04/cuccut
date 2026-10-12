/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsTypeInference(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsTypeInferenceLimit: Dynamic;
  var ComponentsTypeInferenceLimit_2: Dynamic;
  var ComponentsTypeInferenceLimit_3: Dynamic;
  var ComponentsTypeInferenceLimit_4: Dynamic;
  var ComponentsTypeInferenceResolvedValue: Dynamic;
  var TYPE_INFERENCE_OVER_BUDGET: Dynamic;
  var ComponentsTypeInferenceLimit_5: Dynamic;
  var ComponentsTypeInferenceAZaZPattern: Dynamic;
  var ComponentsTypeInferencePattern: Dynamic;
  var ComponentsTypeInferencePattern_2: Dynamic;
  var ComponentsTypeInferenceLimit_6: Dynamic;
  var ComponentsTypeInferenceLimit_7: Dynamic;
  var ComponentsTypeInferenceLimit_8: Dynamic;
  var ComponentsTypeInferenceLimit_9: Dynamic;
  var ComponentsTypeInferenceSubscribers: Dynamic;
  var ComponentsTypeInferenceElementCache: Dynamic;
  var TypeDeclarationResolver: Dynamic;
  var ComponentsTypeInferenceSubscribers_2: Dynamic;
  var ComponentsTypeInferenceTextsRsConfig: Dynamic;
  var typeInferenceIncomplete: Dynamic;
  function convertInferredEnumValue(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return input.numeric === true
      ? Number(options)
      : input.withBool === true && (options === "true" || options === "false")
        ? options === "true"
        : options;
  }
  function isValidTypeDeclarationName(items?: Dynamic): Dynamic {
    return ComponentsTypeInferenceAZaZPattern.test(items) && items.length <= 80;
  }
  function skipBalancedTypeExpression(
    items?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = items[options],
      value2: Dynamic =
        value === "{" ? "}" : value === "(" ? ")" : value === "[" ? "]" : ">",
      index: Dynamic = 0;
    for (let value3: Dynamic = options; value3 < items.length; value3++) {
      let value4: Dynamic = items[value3];
      if (value4 === '"' || value4 === "'" || value4 === "`") {
        let value5: Dynamic = value4;
        for (value3++; value3 < items.length && items[value3] !== value5; ) {
          items[value3] === "\\" && value3++;
          value3++;
        }
        continue;
      }
      if (value4 === "/" && items[value3 + 1] === "*") {
        let value5: Dynamic = items.indexOf("*/", value3 + 2);
        if (value5 === -1) return -1;
        value3 = value5 + 1;
        continue;
      }
      if (value4 === "/" && items[value3 + 1] === "/") {
        let value5: Dynamic = items.indexOf(
          `
`,
          value3,
        );
        if (value5 === -1) return -1;
        value3 = value5;
        continue;
      }
      if (value4 === value) index++;
      else if (value4 === value2 && (index--, index === 0)) return value3 + 1;
    }
    return -1;
  }
  function typeDeclarationEnd(items?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options;
    for (; value < items.length; ) {
      let value2: Dynamic = items[value];
      if (value2 === ";") return value;
      if (value2 === "{" || value2 === "(" || value2 === "[") {
        let value3: Dynamic = skipBalancedTypeExpression(items, value);
        if (value3 === -1) return items.length;
        value = value3;
        continue;
      }
      if (value2 === '"' || value2 === "'" || value2 === "`") {
        let value3: Dynamic = value2;
        for (value++; value < items.length && items[value] !== value3; ) {
          items[value] === "\\" && value++;
          value++;
        }
        value++;
        continue;
      }
      if (value2 === "/" && items[value + 1] === "*") {
        let value3: Dynamic = items.indexOf("*/", value + 2);
        value = value3 === -1 ? items.length : value3 + 2;
        continue;
      }
      if (value2 === "/" && items[value + 1] === "/") {
        let value3: Dynamic = items.indexOf(
          `
`,
          value,
        );
        value = value3 === -1 ? items.length : value3 + 1;
        continue;
      }
      value++;
    }
    return items.length;
  }
  function findTypeDeclaration(input?: Dynamic, options?: Dynamic): Dynamic {
    for (let value of input as Dynamic)
      for (let value2 of ["interface", "type", "const", "enum"] as Dynamic) {
        let index: Dynamic = 0,
          value3: Dynamic = value2 + " " + options;
        for (;;) {
          let value4: Dynamic = value.indexOf(value3, index);
          if (value4 === -1) break;
          index = value4 + value3.length;
          let value5: Dynamic = value4 === 0 ? " " : (value[value4 - 1] ?? " "),
            value6: Dynamic = value[index] ?? " ";
          if (/[\w$]/.test(value5) || /[\w$]/.test(value6)) continue;
          if (value2 === "interface" || value2 === "enum") {
            let value11: Dynamic = value.indexOf("{", index);
            if (value11 === -1) break;
            let value12: Dynamic = skipBalancedTypeExpression(value, value11);
            if (value12 === -1) break;
            return {
              kind: value2,
              head: value.slice(index, value11),
              body: value.slice(value11 + 1, value12 - 1),
            };
          }
          let value7: Dynamic = value
              .slice(index)
              .replace(/^\s*(?:<[^=]*>\s*)?[=:]\s*/, ""),
            value8: Dynamic = value.length - index - value7.length,
            value9: Dynamic = index + value8,
            value10: Dynamic = typeDeclarationEnd(value, value9);
          return {
            kind: value2,
            head: value.slice(value9, value10),
            body: "",
          };
        }
      }
    return null;
  }
  function tokenizeTypeExpression(items?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      index: Dynamic = 0,
      text: Dynamic = "";
    for (
      ;
      index < items.length && items2.length < ComponentsTypeInferenceLimit_3;

    ) {
      let value: Dynamic = items[index];
      if (
        value === " " ||
        value ===
          `
` ||
        value === "	" ||
        value === "\r"
      ) {
        index++;
        continue;
      }
      if (value === "/" && items[index + 1] === "*") {
        let value5: Dynamic = items.indexOf("*/", index + 2),
          value6: Dynamic = items.slice(
            index,
            value5 === -1 ? items.length : value5 + 2,
          );
        text = value6.startsWith("/**") ? value6 : "";
        index = value5 === -1 ? items.length : value5 + 2;
        continue;
      }
      if (value === "/" && items[index + 1] === "/") {
        let value5: Dynamic = items.indexOf(
          `
`,
          index,
        );
        index = value5 === -1 ? items.length : value5 + 1;
        continue;
      }
      let value2: Dynamic = typeDeclarationEnd(items, index),
        value3: Dynamic = items.slice(index, value2);
      index = value2 + 1;
      let value4: Dynamic =
        /^\s*(?:readonly\s+)?(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))(?:\s*(\?))?\s*:\s*([\s\S]+)$/.exec(
          value3,
        );
      if (value4 !== null) {
        let value5: Dynamic = value4[1] ?? value4[2] ?? value4[3] ?? "";
        items2.push({
          name: value5,
          optional: value4[4] !== undefined,
          type: (value4[5] ?? "").trim(),
          doc: text,
        });
      }
      text = "";
    }
    return items2;
  }
  function typeExpressionReferences(items?: Dynamic): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0;
    for (; index < items.length; ) {
      if (items[index] === "{") {
        let value3: Dynamic = skipBalancedTypeExpression(items, index);
        if (value3 === -1) break;
        index = value3;
        continue;
      }
      text += items[index];
      index++;
    }
    let items2: Dynamic = [],
      value: Dynamic = /\b([A-Z][\w$]*)\b(\s*\[)?/g,
      value2: Dynamic;
    for (; (value2 = value.exec(text)) !== null; ) {
      let value3: Dynamic = value2[1] ?? "";
      if (
        value2[2] === undefined &&
        !(
          value3 === "Omit" ||
          value3 === "Pick" ||
          value3 === "Partial" ||
          value3 === "Required" ||
          value3 === "NonNullable" ||
          value3 === "Readonly" ||
          value3 === "React"
        ) &&
        (items2.includes(value3) || items2.push(value3),
        items2.length >= ComponentsTypeInferenceLimit_2)
      )
        break;
    }
    return items2;
  }
  function typeObjectBodies(items?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      index: Dynamic = 0;
    for (; index < items.length; ) {
      let value: Dynamic = items[index];
      if (value === "{") {
        let value2: Dynamic = skipBalancedTypeExpression(items, index);
        if (value2 === -1) break;
        items2.push(items.slice(index + 1, value2 - 1));
        index = value2;
        continue;
      }
      if (value === "(" || value === "[") {
        index++;
        continue;
      }
      if (value === "<") {
        let value2: Dynamic = skipBalancedTypeExpression(items, index);
        index = value2 === -1 ? items.length : value2;
        continue;
      }
      index++;
    }
    return items2;
  }
  function createTypeInferenceState(): Dynamic {
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
  function addInferredLiteral(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    let entry: Dynamic = ComponentsTypeInferenceElementCache.get(
      input.literals,
    );
    entry === undefined &&
      ComponentsTypeInferenceElementCache.set(
        input.literals,
        (entry = new Set(input.literals)),
      );
    !(entry.size > ComponentsTypeInferenceLimit_8) &&
      (entry.has(options) || (entry.add(options), input.literals.push(options)),
      (context || !ComponentsTypeInferencePattern_2.test(options)) &&
        (input.numeric = false));
  }
  function mergeInferredType(input?: Dynamic, source?: Dynamic): Dynamic {
    if (source === null) {
      input.other = true;
      return;
    }
    if (source.kind === "enum") {
      let value: Dynamic = source.options ?? [];
      source.withBool === true && (input.bool = true);
      for (let value2 of (source.withBool === true
        ? value.slice(2)
        : value) as Dynamic)
        addInferredLiteral(input, value2);
      source.numeric !== true && (input.numeric = false);
    } else
      source.kind === "boolean"
        ? (input.bool = true)
        : source.kind === "number"
          ? (input.num = true)
          : ((input.str = true),
            source.typeName !== undefined &&
              input.unresolved.push(source.typeName));
  }
  function inferredEnumType(input?: Dynamic): Dynamic {
    let state: Dynamic = {
      kind: "enum",
      options: [...new Set(input)].slice(0, ComponentsTypeInferenceLimit_8 + 1),
    };
    state.options !== undefined &&
      state.options.length > 0 &&
      state.options.every(
        (input2?: Dynamic): Dynamic =>
          ComponentsTypeInferencePattern_2.test(input2),
      ) &&
      (state.numeric = true);
    return state;
  }
  function inferDeclaredEnum(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      flag: Dynamic = true,
      index: Dynamic = 0;
    for (let value of splitTypeExpression(
      stripTypeComments(input),
      ",",
    ) as Dynamic) {
      let value2: Dynamic =
        /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*(?:=([\s\S]*))?$/.exec(
          value.trim(),
        );
      if (value2 === null) continue;
      let value3: Dynamic =
        value2[4] === undefined ? undefined : value2[4].trim() || undefined;
      if (value3 === undefined) {
        items.push(String(index++));
        continue;
      }
      let value4: Dynamic = ComponentsTypeInferencePattern.exec(value3);
      if (value4 !== null) {
        items.push(value4[1] ?? value4[2] ?? "");
        flag = false;
        continue;
      }
      if (ComponentsTypeInferencePattern_2.test(value3)) {
        items.push(value3);
        index = Number(value3) + 1;
        continue;
      }
      return null;
    }
    if (items.length === 0) return null;
    let state: Dynamic = {
      kind: "enum",
      options: items,
    };
    flag && (state.numeric = true);
    return state;
  }
  function normalizeArrayType(input?: Dynamic): Dynamic {
    let value: Dynamic = unwrapTypeExpression(stripTypeComments(input)).replace(
      /^readonly\s+/,
      "",
    );
    if (value.startsWith("[") && value.endsWith("]"))
      return splitTypeExpression(value.slice(1, -1), ",").join(" | ");
    let value2: Dynamic = /^(?:ReadonlyArray|Array)\s*<([\s\S]*)>$/.exec(value);
    return value2 !== null
      ? (value2[1] ?? "")
      : value.endsWith("[]")
        ? value.slice(0, -2)
        : value;
  }
  function stripTypeComments(items?: Dynamic): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0,
      index2: Dynamic = 0;
    for (; index2 < items.length; ) {
      let value: Dynamic = items[index2];
      if (value === '"' || value === "'" || value === "`") {
        for (index2++; index2 < items.length && items[index2] !== value; )
          index2 += items[index2] === "\\" ? 2 : 1;
        index2++;
        continue;
      }
      if (value === "/" && items[index2 + 1] === "*") {
        text += items.slice(index, index2);
        let value2: Dynamic = items.indexOf("*/", index2 + 2);
        if (value2 === -1) return text.trim();
        index2 = index = value2 + 2;
        continue;
      }
      index2++;
    }
    return (text + items.slice(index)).trim();
  }
  function unwrapTypeExpression(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trim();
    for (
      let index: Dynamic = 0;
      index < 8 &&
      value.startsWith("(") &&
      skipBalancedTypeExpression(value, 0) === value.length;
      index++
    )
      value = value.slice(1, -1).trim();
    return value;
  }
  function conciseTypeDescription(input?: Dynamic): Dynamic {
    let value: Dynamic = stripTypeComments(input).replace(/\s+/g, " ");
    return value.length > 40 ? value.slice(0, 37) + "\u2026" : value;
  }
  function splitTypeExpression(items?: Dynamic, options?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      index: Dynamic = 0,
      index2: Dynamic = 0,
      index3: Dynamic = 0;
    for (; index3 < items.length; ) {
      let value: Dynamic = items[index3];
      if (value === '"' || value === "'" || value === "`") {
        let value2: Dynamic = value;
        for (index3++; index3 < items.length && items[index3] !== value2; ) {
          items[index3] === "\\" && index3++;
          index3++;
        }
        index3++;
        continue;
      }
      value === "{" || value === "(" || value === "[" || value === "<"
        ? index++
        : value === "}" || value === ")" || value === "]" || value === ">"
          ? (value === ">" && items[index3 - 1] === "=") || index--
          : value === options &&
            index === 0 &&
            (items2.push(items.slice(index2, index3).trim()),
            (index2 = index3 + 1));
      index3++;
    }
    items2.push(items.slice(index2).trim());
    return items2.filter((input?: Dynamic): Dynamic => input !== "");
  }
  function inferVariantPropsType(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      /VariantProps<typeof\s+([A-Za-z_$][\w$]*)>\s*\[\s*"([^"]+)"\s*\]/.exec(
        input,
      );
    if (value === null) return null;
    let value2: Dynamic = options.decl(value[1] ?? "");
    if (value2 === null) return null;
    let value3: Dynamic = value[2] ?? "";
    for (let value4 of options.heads(value2.head) as Dynamic)
      for (let value5 of options.members(value4) as Dynamic)
        if (value5.name === value3) return value5.type;
    return null;
  }
  function inferJSDocDefault(input?: Dynamic, source?: Dynamic): Dynamic {
    let value: Dynamic =
      /@default\s+(?:`([^`]*)`|"([^"]*)"|'([^']*)'|(\S+))/.exec(input);
    if (value === null) return;
    let value2: Dynamic = (
      value[1] ??
      value[2] ??
      value[3] ??
      value[4] ??
      ""
    ).replace(/^["'`]|["'`]$/g, "");
    if (source.kind === "boolean")
      return value2 === "true" ? true : value2 === "false" ? false : undefined;
    if (source.kind === "number") {
      let value3: Dynamic = Number(value2);
      return Number.isFinite(value3) ? value3 : undefined;
    }
    return source.kind === "enum"
      ? source.options?.includes(value2) !== true
        ? undefined
        : convertInferredEnumValue(source, value2)
      : value2;
  }
  bindRuntimeValue(
    runtime,
    "convertInferredEnumValue",
    () => convertInferredEnumValue,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit",
    () => ComponentsTypeInferenceLimit,
    (value) => {
      ComponentsTypeInferenceLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit_2",
    () => ComponentsTypeInferenceLimit_2,
    (value) => {
      ComponentsTypeInferenceLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit_3",
    () => ComponentsTypeInferenceLimit_3,
    (value) => {
      ComponentsTypeInferenceLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit_4",
    () => ComponentsTypeInferenceLimit_4,
    (value) => {
      ComponentsTypeInferenceLimit_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceResolvedValue",
    () => ComponentsTypeInferenceResolvedValue,
    (value) => {
      ComponentsTypeInferenceResolvedValue = value;
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
    "ComponentsTypeInferenceLimit_5",
    () => ComponentsTypeInferenceLimit_5,
    (value) => {
      ComponentsTypeInferenceLimit_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceAZaZPattern",
    () => ComponentsTypeInferenceAZaZPattern,
    (value) => {
      ComponentsTypeInferenceAZaZPattern = value;
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
  bindRuntimeValue(
    runtime,
    "tokenizeTypeExpression",
    () => tokenizeTypeExpression,
  );
  bindRuntimeValue(
    runtime,
    "typeExpressionReferences",
    () => typeExpressionReferences,
  );
  bindRuntimeValue(runtime, "typeObjectBodies", () => typeObjectBodies);
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferencePattern",
    () => ComponentsTypeInferencePattern,
    (value) => {
      ComponentsTypeInferencePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferencePattern_2",
    () => ComponentsTypeInferencePattern_2,
    (value) => {
      ComponentsTypeInferencePattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit_6",
    () => ComponentsTypeInferenceLimit_6,
    (value) => {
      ComponentsTypeInferenceLimit_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit_7",
    () => ComponentsTypeInferenceLimit_7,
    (value) => {
      ComponentsTypeInferenceLimit_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit_8",
    () => ComponentsTypeInferenceLimit_8,
    (value) => {
      ComponentsTypeInferenceLimit_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceLimit_9",
    () => ComponentsTypeInferenceLimit_9,
    (value) => {
      ComponentsTypeInferenceLimit_9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceSubscribers",
    () => ComponentsTypeInferenceSubscribers,
    (value) => {
      ComponentsTypeInferenceSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createTypeInferenceState",
    () => createTypeInferenceState,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceElementCache",
    () => ComponentsTypeInferenceElementCache,
    (value) => {
      ComponentsTypeInferenceElementCache = value;
    },
  );
  bindRuntimeValue(runtime, "addInferredLiteral", () => addInferredLiteral);
  bindRuntimeValue(runtime, "mergeInferredType", () => mergeInferredType);
  bindRuntimeValue(
    runtime,
    "TypeDeclarationResolver",
    () => TypeDeclarationResolver,
    (value) => {
      TypeDeclarationResolver = value;
    },
  );
  bindRuntimeValue(runtime, "inferredEnumType", () => inferredEnumType);
  bindRuntimeValue(runtime, "inferDeclaredEnum", () => inferDeclaredEnum);
  bindRuntimeValue(runtime, "normalizeArrayType", () => normalizeArrayType);
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
  bindRuntimeValue(runtime, "inferJSDocDefault", () => inferJSDocDefault);
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceSubscribers_2",
    () => ComponentsTypeInferenceSubscribers_2,
    (value) => {
      ComponentsTypeInferenceSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTypeInferenceTextsRsConfig",
    () => ComponentsTypeInferenceTextsRsConfig,
    (value) => {
      ComponentsTypeInferenceTextsRsConfig = value;
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
  return () => {
    ComponentsTypeInferenceLimit = 24;
    ComponentsTypeInferenceLimit_2 = 32;
    ComponentsTypeInferenceLimit_3 = 2e3;
    ComponentsTypeInferenceLimit_4 = 5e4;
    ComponentsTypeInferenceResolvedValue = 256 * 1024 * 1024;
    TYPE_INFERENCE_OVER_BUDGET = Symbol("over budget");
    ComponentsTypeInferenceLimit_5 = 4;
    ComponentsTypeInferenceAZaZPattern = /^[A-Za-z_$][\w$]*$/;
    ComponentsTypeInferencePattern = /^(?:"([^"\\]*)"|'([^'\\]*)')$/;
    ComponentsTypeInferencePattern_2 = /^-?\d+(?:\.\d+)?$/;
    ComponentsTypeInferenceLimit_6 = 12;
    ComponentsTypeInferenceLimit_7 = 64;
    ComponentsTypeInferenceLimit_8 = 400;
    ComponentsTypeInferenceLimit_9 = 3;
    ComponentsTypeInferenceSubscribers = new Set([
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
    ComponentsTypeInferenceElementCache = new WeakMap();
    TypeDeclarationResolver = class {
      constructor(input: Dynamic) {
        this.texts = input;
        this.textBytes = input.reduce(
          (input2?: Dynamic, items?: Dynamic): Dynamic => input2 + items.length,
          0,
        );
      }
      texts: Dynamic;
      decls: Dynamic = new Map();
      named: Dynamic = new Map();
      busy: Dynamic = new Set();
      textBytes: Dynamic;
      work: Dynamic = 0;
      scanned: Dynamic = 0;
      reuse(): Dynamic {
        this.work = 0;
        this.scanned = 0;
        this.busy.clear();
        this.named.clear();
        return this;
      }
      tick(input: Dynamic = 1): Dynamic {
        if ((this.work += input) > ComponentsTypeInferenceLimit_4)
          throw TYPE_INFERENCE_OVER_BUDGET;
      }
      charge(input: Dynamic): Dynamic {
        if ((this.scanned += input) > ComponentsTypeInferenceResolvedValue)
          throw TYPE_INFERENCE_OVER_BUDGET;
      }
      headBodies: Dynamic = new Map();
      heads(items: Dynamic): Dynamic {
        let entry: Dynamic = this.headBodies.get(items);
        entry === undefined &&
          (this.charge(items.length),
          (entry = typeObjectBodies(items)),
          this.headBodies.set(items, entry));
        this.tick();
        return entry;
      }
      bodies: Dynamic = new Map();
      members(items: Dynamic): Dynamic {
        let entry: Dynamic = this.bodies.get(items);
        entry === undefined &&
          (this.charge(items.length),
          (entry = tokenizeTypeExpression(items)),
          this.bodies.set(items, entry));
        this.tick(1 + (entry.length >> 4));
        return entry;
      }
      decl(input: Dynamic): Dynamic {
        let entry: Dynamic = this.decls.get(input);
        if (entry !== undefined) return entry;
        this.tick(25);
        this.charge(this.textBytes);
        let value: Dynamic = findTypeDeclaration(this.texts, input);
        this.decls.set(input, value);
        return value;
      }
      resolve(input: Dynamic, options: Dynamic): Dynamic {
        this.tick();
        let value: Dynamic = createTypeInferenceState();
        this.arms(input, options, value);
        return this.control(value, input);
      }
      resolveName(input: Dynamic, options: Dynamic): Dynamic {
        let entry: Dynamic = this.named.get(input);
        if (entry !== undefined) return entry;
        if (this.busy.has(input) || options > ComponentsTypeInferenceLimit_6)
          return {
            kind: "string",
            typeName: input,
          };
        this.busy.add(input);
        let value: Dynamic,
          value2: Dynamic = this.decl(input);
        value2 === null
          ? (value = ComponentsTypeInferenceSubscribers.has(input)
              ? null
              : {
                  kind: "string",
                  typeName: input,
                })
          : value2.kind === "type"
            ? ((value = this.resolve(value2.head, options + 1)),
              value !== null &&
                value.kind === "string" &&
                value.typeName !== undefined &&
                this.decl(value.typeName) === null &&
                (value = {
                  kind: "string",
                  typeName: input,
                }))
            : value2.kind === "enum"
              ? (value = inferDeclaredEnum(value2.body))
              : (value = null);
        this.busy.delete(input);
        this.named.set(input, value);
        return value;
      }
      arms(items: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        this.charge(items.length);
        for (let value of splitTypeExpression(
          stripTypeComments(items),
          "|",
        ) as Dynamic) {
          this.tick();
          this.charge(value.length);
          let value2: Dynamic = unwrapTypeExpression(value);
          if (
            value2 === "" ||
            value2 === "undefined" ||
            value2 === "null" ||
            value2 === "never"
          )
            continue;
          let value3: Dynamic = ComponentsTypeInferencePattern.exec(value2);
          if (value3 !== null) {
            addInferredLiteral(context, value3[1] ?? value3[2] ?? "", true);
            continue;
          }
          if (ComponentsTypeInferencePattern_2.test(value2)) {
            addInferredLiteral(context, value2);
            continue;
          }
          if (value2 === "boolean" || value2 === "true" || value2 === "false") {
            context.bool = true;
            continue;
          }
          if (value2 === "number") {
            context.num = true;
            continue;
          }
          if (value2 === "string") {
            context.str = true;
            continue;
          }
          if (value2 === "ReactNode" || value2 === "React.ReactNode") {
            context.node = true;
            continue;
          }
          if (value2.startsWith("`") && value2.endsWith("`")) {
            let value5: Dynamic = this.template(value2.slice(1, -1), options);
            if (value5 === null) context.str = true;
            else
              for (let value6 of value5 as Dynamic)
                addInferredLiteral(context, value6);
            continue;
          }
          let value4: Dynamic = this.special(value2, options);
          if (value4 !== undefined) {
            mergeInferredType(context, value4);
            continue;
          }
          if (ComponentsTypeInferenceAZaZPattern.test(value2)) {
            mergeInferredType(context, this.resolveName(value2, options));
            continue;
          }
          context.other = true;
        }
      }
      special(input: Dynamic, options: Dynamic): Dynamic {
        let value: Dynamic = /^([A-Za-z_$][\w$]*)\s*<([\s\S]*)>$/.exec(input);
        if (value !== null) {
          if (options > ComponentsTypeInferenceLimit_6) return null;
          let value6: Dynamic = value[1] ?? "",
            value7: Dynamic = splitTypeExpression(value[2] ?? "", ",");
          return value6 === "NonNullable" && value7.length === 1
            ? this.resolve(value7[0] ?? "", options + 1)
            : (value6 === "Extract" || value6 === "Exclude") &&
                value7.length === 2
              ? this.extract(
                  value6 === "Extract",
                  value7[0] ?? "",
                  value7[1] ?? "",
                  options,
                )
              : null;
        }
        let value2: Dynamic = inferVariantPropsType(input, this);
        if (value2 !== null) return this.resolve(value2, options + 1);
        let value3: Dynamic = /^keyof\s+(typeof\s+)?([A-Za-z_$][\w$]*)$/.exec(
          input,
        );
        if (value3 !== null) {
          let value6: Dynamic = this.keysOf(
            value3[2] ?? "",
            value3[1] !== undefined,
            options,
          );
          return value6 === null ? null : inferredEnumType(value6);
        }
        let value4: Dynamic =
          /^\(?\s*typeof\s+([A-Za-z_$][\w$]*)\s*\)?\s*\[\s*number\s*\]$/.exec(
            input,
          );
        if (value4 !== null) {
          let value6: Dynamic = this.decl(value4[1] ?? "");
          return value6 === null || value6.kind !== "const"
            ? null
            : (this.charge(value6.head.length),
              this.resolve(normalizeArrayType(value6.head), options + 1));
        }
        let value5: Dynamic =
          /^([A-Za-z_$][\w$]*)\s*\[\s*(?:"([^"]+)"|'([^']+)')\s*\]$/.exec(
            input,
          );
        if (value5 !== null) {
          let value6: Dynamic = this.memberType(
            value5[1] ?? "",
            value5[2] ?? value5[3] ?? "",
            options,
          );
          return value6 === null ? null : this.resolve(value6, options + 1);
        }
        if (input.startsWith("typeof ")) return null;
      }
      extract(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
        value: Dynamic,
      ): Dynamic {
        let value2: Dynamic = createTypeInferenceState();
        this.arms(context, value + 1, value2);
        let value3: Dynamic = createTypeInferenceState();
        this.arms(options, value + 1, value3);
        if (input) {
          if (
            value3.literals.length === 0 &&
            !value3.str &&
            !value3.num &&
            !value3.bool &&
            value2.literals.length > 0 &&
            !value2.str
          )
            return inferredEnumType(value2.literals);
          let state2: Dynamic = {
            ...createTypeInferenceState(),
            literals: value2.str
              ? value3.literals
              : value3.literals.filter(
                  (input2?: Dynamic): Dynamic =>
                    value2.literals.includes(input2),
                ),
          };
          state2.numeric = state2.literals.every(
            (input2?: Dynamic): Dynamic =>
              ComponentsTypeInferencePattern_2.test(input2),
          );
          state2.str = value3.str && value2.str;
          state2.num = value3.num && value2.num;
          state2.bool = value3.bool && value2.bool;
          state2.node = value3.node && value2.node;
          return this.control(state2, options);
        }
        let state: Dynamic = {
          ...value3,
          literals: value3.literals.filter(
            (input2?: Dynamic): Dynamic => !value2.literals.includes(input2),
          ),
          unresolved: [...value3.unresolved],
        };
        value2.str && (state.literals = []);
        state.numeric = state.literals.every(
          (input2?: Dynamic): Dynamic =>
            ComponentsTypeInferencePattern_2.test(input2),
        );
        value2.bool && (state.bool = false);
        value2.num && (state.num = false);
        value2.str && (state.str = false);
        return this.control(state, options);
      }
      keysOf(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        if (context > ComponentsTypeInferenceLimit_6) return null;
        let value: Dynamic = this.decl(input);
        if (value === null) return null;
        if (options) {
          if (value.kind !== "const") return null;
          let value5: Dynamic = this.heads(value.head);
          return value5.length === 0
            ? null
            : this.members(value5[0] ?? "").map(
                (input2?: Dynamic): Dynamic => input2.name,
              );
        }
        if (value.kind === "interface")
          return this.members(value.body).map(
            (input2?: Dynamic): Dynamic => input2.name,
          );
        if (value.kind !== "type") return null;
        this.charge(value.head.length);
        let value2: Dynamic = unwrapTypeExpression(
            stripTypeComments(value.head),
          ),
          value3: Dynamic = /^typeof\s+([A-Za-z_$][\w$]*)$/.exec(value2);
        if (value3 !== null)
          return this.keysOf(value3[1] ?? "", true, context + 1);
        if (ComponentsTypeInferenceAZaZPattern.test(value2))
          return this.keysOf(value2, false, context + 1);
        let value4: Dynamic = this.heads(value2);
        return value4.length === 0
          ? null
          : this.members(value4[0] ?? "").map(
              (input2?: Dynamic): Dynamic => input2.name,
            );
      }
      memberType(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        if (context > ComponentsTypeInferenceLimit_6) return null;
        let value: Dynamic = this.decl(input);
        if (value === null || value.kind === "enum") return null;
        let value2: Dynamic =
          value.kind === "interface" ? [value.body] : this.heads(value.head);
        for (let value3 of value2 as Dynamic)
          for (let value4 of this.members(value3) as Dynamic)
            if (value4.name === options) return value4.type;
        if (value.kind === "type") {
          this.charge(value.head.length);
          let value3: Dynamic = unwrapTypeExpression(
            stripTypeComments(value.head),
          );
          if (ComponentsTypeInferenceAZaZPattern.test(value3))
            return this.memberType(value3, options, context + 1);
        }
        return null;
      }
      template(items: Dynamic, options: Dynamic): Dynamic {
        let items2: Dynamic = [""],
          index: Dynamic = 0;
        for (; index < items.length; ) {
          let value: Dynamic = items.indexOf("${", index);
          if (value === -1) {
            let value6: Dynamic = items.slice(index);
            items2 = items2.map((input?: Dynamic): Dynamic => input + value6);
            break;
          }
          let value2: Dynamic = items.slice(index, value),
            value3: Dynamic = skipBalancedTypeExpression(items, value + 1);
          if (value3 === -1) return null;
          let value4: Dynamic = this.resolve(
            items.slice(value + 2, value3 - 1),
            options + 1,
          );
          if (value4 === null || value4.kind !== "enum") return null;
          let value5: Dynamic = value4.options ?? [];
          if (items2.length * value5.length > ComponentsTypeInferenceLimit_7)
            return null;
          items2 = items2.flatMap(
            (input?: Dynamic): Dynamic =>
              value5.map(
                (input2?: Dynamic): Dynamic => input + value2 + input2,
              ),
          );
          index = value3;
        }
        return items2;
      }
      control(input: Dynamic, options: Dynamic): Dynamic {
        let literals: Dynamic = input.literals,
          value: Dynamic = input.str || input.node;
        if (literals.length > 0 && !value) {
          if (input.num && literals.length < ComponentsTypeInferenceLimit_9)
            return {
              kind: "string",
              typeName: conciseTypeDescription(options),
            };
          if (literals.length > ComponentsTypeInferenceLimit_8)
            return {
              kind: "string",
              typeName: conciseTypeDescription(options),
            };
          let state: Dynamic = {
            kind: "enum",
            options: input.bool ? ["true", "false", ...literals] : literals,
          };
          input.bool
            ? (state.withBool = true)
            : input.numeric && (state.numeric = true);
          return state;
        }
        return value
          ? !input.str && input.other && input.unresolved.length === 0
            ? {
                kind: "string",
                typeName: "ReactNode",
              }
            : input.unresolved.length > 0
              ? {
                  kind: "string",
                  typeName: input.unresolved[0],
                }
              : {
                  kind: "string",
                }
          : input.num && !input.bool
            ? {
                kind: "number",
              }
            : input.bool && !input.num
              ? {
                  kind: "boolean",
                }
              : input.num && input.bool
                ? {
                    kind: "string",
                    typeName: conciseTypeDescription(options),
                  }
                : input.unresolved.length > 0
                  ? {
                      kind: "string",
                      typeName: input.unresolved[0],
                    }
                  : null;
      }
    };
    ComponentsTypeInferenceSubscribers_2 = new Set([
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
    ComponentsTypeInferenceTextsRsConfig = null;
    typeInferenceIncomplete = false;
  };
}
