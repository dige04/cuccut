/** Restored application module; prepare first, initialize in original order. */
import type * as Core from "../contracts/model-core";
import type * as Model from "../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelTokenCommands(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var defaultFontFamilyStack: (name: string) => string;
  var autoCreatedFontFamilyKeys: Set<string>;
  function updateTokens(
    content: Model.DesignSystemContent,
    mutate: (tokens: Model.NormalizedTokens) => boolean,
  ) {
    let tokens = structuredClone(
      (0, runtime.parsedDesignSystem)(content).tokens,
    );
    if (!mutate(tokens)) {
      return content;
    }
    return (0, runtime.setDesignSystemFile)(
      content,
      runtime.DESIGN_SYSTEM_PATHS.tokens,
      (0, runtime.serializeTokens)(tokens),
    );
  }
  function setColorTokenValue(
    content: Model.DesignSystemContent,
    name: string,
    themeId: string,
    value: unknown,
  ) {
    let normalized = (0, runtime.normalizeColorOrAlias)(value);
    if (normalized === undefined) {
      return content;
    }
    return updateTokens(content, (input): boolean => {
      if (
        !input.color.themes.some((input2): boolean => input2.id === themeId)
      ) {
        return false;
      }
      let value2 = (0, runtime.colorAliasTarget)(normalized);
      if (
        value2 !== undefined &&
        (value2 === name ||
          !input.color.tokens.some(
            (input2): boolean => input2.name === value2,
          ) ||
          (0, runtime.detectColorAliasCycle)(
            input,
            name,
            themeId,
            normalized,
          ) !== undefined)
      ) {
        return false;
      }
      for (let value3 of input.color.tokens) {
        if (value3.name === name) {
          if (value3.value[themeId] === normalized) {
            return false;
          }
          value3.value[themeId] = normalized;
          return true;
        }
      }
      return false;
    });
  }
  function clearColorThemeOverride(
    content: Model.DesignSystemContent,
    name: string,
    themeId: string,
  ) {
    return updateTokens(content, (input): boolean => {
      if (
        input.color.themes.length === 0 ||
        input.color.themes[0]?.id === themeId
      ) {
        return false;
      }
      if (
        !input.color.themes.some((input2): boolean => input2.id === themeId)
      ) {
        return false;
      }
      for (let value of input.color.tokens) {
        if (value.name === name) {
          if (
            !Object.hasOwn(value.value, themeId) ||
            (0, runtime.detectColorAliasCycle)(input, name, themeId, "") !==
              undefined
          ) {
            return false;
          }
          delete value.value[themeId];
          return true;
        }
      }
      return false;
    });
  }
  function setColorTokenUsage(
    content: Model.DesignSystemContent,
    name: string,
    usage: string,
  ) {
    let clampedUsage = Array.from(usage)
      .slice(0, runtime.MAX_TOKEN_USAGE_LENGTH)
      .join("");
    return updateTokens(content, (input): boolean => {
      for (let value of input.color.tokens) {
        if (value.name === name) {
          if (value.usage === clampedUsage) {
            return false;
          }
          value.usage = clampedUsage;
          return true;
        }
      }
      return false;
    });
  }
  function editableTokensForFamily(
    tokens: Model.NormalizedTokens,
    family: Core.ValueTokenKind,
  ) {
    if (family === "extra") {
      return (0, runtime.allExtraTokens)(tokens);
    } else {
      return tokens[family].tokens;
    }
  }
  function scalarTokensForFamily(
    tokens: Model.NormalizedTokens,
    family: Core.ScalarKind,
  ) {
    if (family === "extra") {
      return (0, runtime.allExtraTokens)(tokens);
    } else {
      return tokens[family].tokens;
    }
  }
  function setTokenUsage(
    content: Model.DesignSystemContent,
    family: Core.ValueTokenKind,
    name: string,
    usage: string,
  ) {
    let clampedUsage = Array.from(usage)
      .slice(0, runtime.MAX_TOKEN_USAGE_LENGTH)
      .join("");
    return updateTokens(content, (input): boolean => {
      let value = editableTokensForFamily(input, family).find(
        (input2): boolean => input2.name === name,
      );
      if (value === undefined || value.usage === clampedUsage) {
        return false;
      }
      value.usage = clampedUsage;
      return true;
    });
  }
  function setShadowTokenValue(
    content: Model.DesignSystemContent,
    name: string,
    themeId: string,
    value: unknown,
  ) {
    let normalized = (0, runtime.normalizeBoxShadow)(value);
    if (normalized === undefined) {
      return content;
    }
    return updateTokens(content, (input): boolean => {
      if (
        !input.color.themes.some((input2): boolean => input2.id === themeId)
      ) {
        return false;
      }
      let value2 = input.shadow.tokens.find(
        (input2): boolean => input2.name === name,
      );
      if (value2 === undefined || value2.value[themeId] === normalized) {
        return false;
      }
      value2.value[themeId] = normalized;
      return true;
    });
  }
  function setTypographyStyleUsage(
    content: Model.DesignSystemContent,
    name: string,
    usage: string,
  ) {
    let clampedUsage = Array.from(usage)
      .slice(0, runtime.MAX_TOKEN_USAGE_LENGTH)
      .join("");
    return updateTokens(content, (input): boolean => {
      for (let value of input.type.groups) {
        for (let value2 of value.styles) {
          if (value2.name === name) {
            if (value2.usage === clampedUsage) {
              return false;
            }
            value2.usage = clampedUsage;
            return true;
          }
        }
      }
      return false;
    });
  }
  function setTokenFamilyNote(
    content: Model.DesignSystemContent,
    family: Core.ScalarKind,
    note: string,
    extraFamily?: string,
  ) {
    let clampedNote = Array.from(note.replace(/\s+/g, " ").trim())
      .slice(0, runtime.MAX_TOKEN_NOTE_LENGTH)
      .join("");
    return updateTokens(content, (input): boolean => {
      let value =
        family === "extra"
          ? input.extra.find((input2): boolean => input2.key === extraFamily)
          : input[family];
      if (value === undefined || value.note === clampedNote) {
        return false;
      }
      value.note = clampedNote;
      return true;
    });
  }
  function setScalarTokenValue(
    content: Model.DesignSystemContent,
    family: Core.ScalarKind,
    name: string,
    value: unknown,
  ) {
    let normalized = (0, runtime.normalizeScalarTokenValue)(family, value);
    if (normalized === undefined) {
      return content;
    }
    return updateTokens(content, (input): boolean => {
      let value2 = scalarTokensForFamily(input, family).find(
        (input2): boolean => input2.name === name,
      );
      if (value2 === undefined || value2.value === normalized) {
        return false;
      }
      value2.value = normalized;
      return true;
    });
  }
  function findFontFamilyKey(
    families: Record<string, string>,
    fontName: string,
  ) {
    let normalizedName = fontName.trim().toLowerCase();
    if (normalizedName === "") {
      return;
    }
    for (let [value, value2] of Object.entries(families)) {
      let value3 = /^\s*(?:"([^"]{1,80})"|'([^']{1,80})'|([^,'"]{1,80}))/.exec(
        value2,
      );
      if (
        (value3?.[1] ?? value3?.[2] ?? value3?.[3] ?? "")
          .trim()
          .toLowerCase() === normalizedName ||
        value === normalizedName
      ) {
        return value;
      }
    }
    return;
  }
  function pruneUnusedFontFamily(
    tokens: Model.NormalizedTokens,
    key: string,
  ): void {
    if (key === "" || !autoCreatedFontFamilyKeys.has(key)) {
      return;
    }
    let stack = tokens.type.families[key],
      fontName =
        stack === undefined
          ? null
          : (/^'([^']+)', sans-serif$/.exec(stack)?.[1] ?? null);
    if (fontName === null || stack !== defaultFontFamilyStack(fontName)) {
      return;
    }
    if (
      tokens.type.groups.some(
        (input) =>
          input.family === key ||
          input.styles.some((input2): boolean => input2.family === key),
      ) ||
      tokens.type.fonts.some(
        (input) =>
          input.family.trim().toLowerCase() === fontName.toLowerCase() ||
          findFontFamilyKey(tokens.type.families, input.family) === key,
      )
    ) {
      return;
    }
    delete tokens.type.families[key];
  }
  function pruneUnusedFontFamilies(tokens: Model.NormalizedTokens): void {
    for (let value of Object.keys(tokens.type.families)) {
      pruneUnusedFontFamily(tokens, value);
    }
  }
  function validateNewFontFamily(
    fontName: string,
    families: Record<string, string>,
  ): string | null {
    let normalized = fontName.replace(/\s+/g, " ").trim();
    if (normalized === "") {
      return "A font name is needed.";
    }
    if (
      /['",]/.test(normalized) ||
      !runtime.FONT_STACK_PATTERN.test(defaultFontFamilyStack(normalized)) ||
      normalized.length > 80
    ) {
      return "One font name, without quotes, commas or CSS punctuation.";
    }
    if (
      findFontFamilyKey(families, normalized) === undefined &&
      Object.keys(families).length >= runtime.MAX_FONT_FAMILIES
    ) {
      return (
        "The system already has " +
        String(runtime.MAX_FONT_FAMILIES) +
        " font families — pick one of them."
      );
    }
    return null;
  }
  function setTypographyFontFamily(
    content: Model.DesignSystemContent,
    styleName: string,
    fontName: string,
  ) {
    let normalized = fontName.replace(/\s+/g, " ").trim();
    return updateTokens(content, (input): boolean => {
      if (validateNewFontFamily(normalized, input.type.families) !== null) {
        return false;
      }
      let value = findFontFamilyKey(input.type.families, normalized);
      if (value === undefined) {
        let value2 = defaultFontFamilyStack(normalized),
          value3 =
            (
              normalized
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "") || "font"
            )
              .slice(0, 48)
              .replace(/-+$/, "") || "font";
        value = value3;
        for (
          let count: number = 2;
          Object.hasOwn(input.type.families, value);
          count++
        ) {
          value = value3 + "-" + String(count);
        }
        if (!runtime.TOKEN_NAME_PATTERN.test(value)) {
          return false;
        }
        input.type.families[value] = value2;
        autoCreatedFontFamilyKeys.add(value);
      }
      for (let value2 of input.type.groups) {
        for (let value3 of value2.styles) {
          if (value3.name === styleName) {
            if (value3.family === value) {
              return false;
            }
            let family = value3.family;
            value3.family = value;
            if (family !== value) {
              pruneUnusedFontFamily(input, family);
            }
            return true;
          }
        }
      }
      return false;
    });
  }
  function setTypographyProperty<K extends Core.TypographyProperty>(
    content: Model.DesignSystemContent,
    styleName: string,
    property: K,
    value: unknown,
  ) {
    return updateTokens(content, (input): boolean => {
      let value2 = (0, runtime.normalizeTypographyProperty)(
        property,
        value,
        input.type.families,
      );
      if (value2 === undefined) {
        return false;
      }
      for (let value3 of input.type.groups) {
        for (let value4 of value3.styles) {
          if (value4.name === styleName) {
            if (value4[property] === value2) {
              return false;
            }
            let family = value4.family;
            value4[property] = value2;
            if (property === "family") {
              pruneUnusedFontFamily(input, family);
            }
            return true;
          }
        }
      }
      return false;
    });
  }
  function typographyStyleByName(tokens: Model.NormalizedTokens, name: string) {
    for (let value of tokens.type.groups) {
      for (let value2 of value.styles) {
        if (value2.name === name) {
          return value2;
        }
      }
    }
    return;
  }
  function normalizeTokenName(name: string) {
    return name.trim().replace(/^--/, "");
  }
  function renameReadmeTokenCodeSpans(
    readme: string,
    oldName: string,
    newName: string,
  ) {
    return readme.split("`" + oldName + "`").join("`" + newName + "`");
  }
  function renameToken(
    content: Model.DesignSystemContent,
    family: Core.TokenKind,
    oldName: string,
    newName: string,
  ) {
    let normalizedName = normalizeTokenName(newName);
    if (
      !runtime.TOKEN_NAME_PATTERN.test(normalizedName) ||
      normalizedName === oldName
    ) {
      return content;
    }
    let tokens = (0, runtime.parsedDesignSystem)(content).tokens;
    if (
      !(0, runtime.tokenNamesForFamily)(tokens, family).includes(oldName) ||
      (0, runtime.conflictingTokenNames)(tokens, family).includes(
        normalizedName,
      )
    ) {
      return content;
    }
    let renamed = renameTokenInTokens(content, family, oldName, normalizedName);
    if (renamed === content) {
      return content;
    }
    let readme = renamed.files[runtime.DESIGN_SYSTEM_PATHS.readme];
    if (readme === undefined) {
      return renamed;
    } else {
      return (0, runtime.setDesignSystemReadme)(
        renamed,
        renameReadmeTokenCodeSpans(readme, oldName, normalizedName),
      );
    }
  }
  function renameColorTokensAtomically(
    content: Model.DesignSystemContent,
    renames: [string, string][],
  ) {
    let working = content;
    for (let [value, value2] of renames) {
      if (value === value2) {
        continue;
      }
      let value3 = renameToken(working, "color", value, value2);
      if (value3 === working) {
        return content;
      }
      working = value3;
    }
    return working;
  }
  function renameTokenInTokens(
    content: Model.DesignSystemContent,
    family: Core.TokenKind,
    oldName: string,
    newName: string,
  ) {
    return updateTokens(content, (input): boolean => {
      if ((0, runtime.conflictingTokenNames)(input, family).includes(newName)) {
        return false;
      }
      if (family === "color") {
        let value2 = input.color.tokens.find(
          (input2): boolean => input2.name === oldName,
        );
        if (value2 === undefined) {
          return false;
        }
        value2.name = newName;
        for (let value3 of input.color.tokens) {
          for (let value4 of Object.keys(value3.value)) {
            if (value3.value[value4] === "{" + oldName + "}") {
              value3.value[value4] = "{" + newName + "}";
            }
          }
        }
        return true;
      }
      let value =
        family === "type"
          ? typographyStyleByName(input, oldName)
          : editableTokensForFamily(input, family).find(
              (input2): boolean => input2.name === oldName,
            );
      if (value === undefined) {
        return false;
      }
      value.name = newName;
      return true;
    });
  }
  function resolveAliasesBeforeTokenDeletion(
    tokens: Model.NormalizedTokens,
    deletedNames: ReadonlySet<string>,
  ): void {
    for (let value of tokens.color.tokens) {
      if (deletedNames.has(value.name)) {
        continue;
      }
      let state: Record<string, string | undefined> = {},
        flag: boolean = false;
      for (let value2 of tokens.color.themes) {
        let value3 = (0, runtime.colorAliasTarget)(
          (0, runtime.colorValueForThemeModelTokens)(value, value2.id, tokens),
        );
        if (value3 !== undefined && deletedNames.has(value3)) {
          flag = true;
          state[value2.id] = (0, runtime.resolveColorTokenValue)(
            value,
            value2.id,
            tokens,
          );
        }
      }
      if (!flag) {
        continue;
      }
      for (let [value2, value3] of Object.entries(state)) {
        if (value3 !== undefined) {
          value.value[value2] = value3;
        } else {
          delete value.value[value2];
        }
      }
    }
  }
  function deleteColorTokens(
    content: Model.DesignSystemContent,
    names: string[],
  ) {
    let deletedNames = new Set(
      names.filter((input) =>
        (0, runtime.tokenNamesForFamily)(
          (0, runtime.parsedDesignSystem)(content).tokens,
          "color",
        ).includes(input),
      ),
    );
    if (deletedNames.size === 0) {
      return content;
    }
    return updateTokens(content, (input): boolean => {
      resolveAliasesBeforeTokenDeletion(input, deletedNames);
      input.color.tokens = input.color.tokens.filter(
        (input2): boolean => !deletedNames.has(input2.name),
      );
      return true;
    });
  }
  function deleteToken(
    content: Model.DesignSystemContent,
    family: Core.TokenKind,
    name: string,
  ) {
    let tokens = (0, runtime.parsedDesignSystem)(content).tokens;
    if (!(0, runtime.tokenNamesForFamily)(tokens, family).includes(name)) {
      return content;
    }
    return updateTokens(content, (input): boolean => {
      if (family === "color") {
        resolveAliasesBeforeTokenDeletion(input, new Set([name]));
        let length = input.color.tokens.length;
        input.color.tokens = input.color.tokens.filter(
          (input2): boolean => input2.name !== name,
        );
        return input.color.tokens.length !== length;
      }
      if (family === "type") {
        for (let value3 of input.type.groups) {
          let value4 = value3.styles.findIndex(
            (input2): boolean => input2.name === name,
          );
          if (value4 >= 0) {
            value3.styles.splice(value4, 1);
            if (value3.styles.length === 0) {
              input.type.groups = input.type.groups.filter(
                (input2): boolean => input2 !== value3,
              );
            }
            pruneUnusedFontFamilies(input);
            return true;
          }
        }
        return false;
      }
      if (family === "extra") {
        for (let value3 of input.extra) {
          let value4 = value3.tokens.findIndex(
            (input2): boolean => input2.name === name,
          );
          if (value4 < 0) {
            continue;
          }
          value3.tokens.splice(value4, 1);
          if (value3.tokens.length === 0) {
            input.extra = input.extra.filter(
              (input2): boolean => input2 !== value3,
            );
          }
          return true;
        }
        return false;
      }
      let value = editableTokensForFamily(input, family),
        value2 = value.findIndex((input2): boolean => input2.name === name);
      if (value2 < 0) {
        return false;
      }
      value.splice(value2, 1);
      return true;
    });
  }
  bindRuntimeValue(runtime, "updateTokens", () => updateTokens);
  bindRuntimeValue(runtime, "setColorTokenValue", () => setColorTokenValue);
  bindRuntimeValue(
    runtime,
    "clearColorThemeOverride",
    () => clearColorThemeOverride,
  );
  bindRuntimeValue(runtime, "setColorTokenUsage", () => setColorTokenUsage);
  bindRuntimeValue(
    runtime,
    "editableTokensForFamily",
    () => editableTokensForFamily,
  );
  bindRuntimeValue(
    runtime,
    "scalarTokensForFamily",
    () => scalarTokensForFamily,
  );
  bindRuntimeValue(runtime, "setTokenUsage", () => setTokenUsage);
  bindRuntimeValue(runtime, "setShadowTokenValue", () => setShadowTokenValue);
  bindRuntimeValue(
    runtime,
    "setTypographyStyleUsage",
    () => setTypographyStyleUsage,
  );
  bindRuntimeValue(runtime, "setTokenFamilyNote", () => setTokenFamilyNote);
  bindRuntimeValue(runtime, "setScalarTokenValue", () => setScalarTokenValue);
  bindRuntimeValue(runtime, "findFontFamilyKey", () => findFontFamilyKey);
  bindRuntimeValue(
    runtime,
    "defaultFontFamilyStack",
    () => defaultFontFamilyStack,
    (value) => {
      defaultFontFamilyStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "autoCreatedFontFamilyKeys",
    () => autoCreatedFontFamilyKeys,
    (value) => {
      autoCreatedFontFamilyKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pruneUnusedFontFamily",
    () => pruneUnusedFontFamily,
  );
  bindRuntimeValue(
    runtime,
    "pruneUnusedFontFamilies",
    () => pruneUnusedFontFamilies,
  );
  bindRuntimeValue(
    runtime,
    "validateNewFontFamily",
    () => validateNewFontFamily,
  );
  bindRuntimeValue(
    runtime,
    "setTypographyFontFamily",
    () => setTypographyFontFamily,
  );
  bindRuntimeValue(
    runtime,
    "setTypographyProperty",
    () => setTypographyProperty,
  );
  bindRuntimeValue(
    runtime,
    "typographyStyleByName",
    () => typographyStyleByName,
  );
  bindRuntimeValue(runtime, "normalizeTokenName", () => normalizeTokenName);
  bindRuntimeValue(
    runtime,
    "renameReadmeTokenCodeSpans",
    () => renameReadmeTokenCodeSpans,
  );
  bindRuntimeValue(runtime, "renameToken", () => renameToken);
  bindRuntimeValue(
    runtime,
    "renameColorTokensAtomically",
    () => renameColorTokensAtomically,
  );
  bindRuntimeValue(runtime, "renameTokenInTokens", () => renameTokenInTokens);
  bindRuntimeValue(
    runtime,
    "resolveAliasesBeforeTokenDeletion",
    () => resolveAliasesBeforeTokenDeletion,
  );
  bindRuntimeValue(runtime, "deleteColorTokens", () => deleteColorTokens);
  bindRuntimeValue(runtime, "deleteToken", () => deleteToken);
  return () => {
    defaultFontFamilyStack = (input): string => "'" + input + "', sans-serif";
    autoCreatedFontFamilyKeys = new Set();
  };
}
