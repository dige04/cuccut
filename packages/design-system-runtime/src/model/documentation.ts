import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelDocumentation(
  runtime: RuntimeBindings,
): () => void {
  var DEFAULT_TOKEN_CARD_MODE: string;
  var GENERATED_CONSUMPTION_HEADING: string;
  var GENERATED_INDEX_HEADING: string;
  var GENERATED_INLINE_TOKENS_HEADING: string;
  var GENERATED_README_SEPARATOR: string;
  var STANDALONE_MIGRATION_HEADING: string;
  var STANDALONE_MIGRATION_PREFIXES: [string, string];
  var STANDALONE_CONSUMPTION_GUIDANCE: string;
  var OMITTED_API_CARDS_NOTICE: string;
  var DOCS_GLOBAL_IDENTIFIER_PATTERN: RegExp;
  var sanitizeMarkdownLine: (text: string) => string;
  var sanitizeComponentGroupLabel: (text: string) => string;
  var MAX_DOCUMENTED_COMPONENTS: number;
  var unicodeCharacterCount: (text: string) => number;
  var truncateUnicodeText: (text: string, limit: number) => string;
  var countSubstring: (text: string, part: string) => number;
  var uniqueValues: <Value>(values: readonly Value[]) => Value[];
  var formatCardCharacterCount: (count: number) => string;
  var markdownCodeSpan: (text: string) => string;
  var markdownTableCell: (text: string) => string;
  var MARKDOWN_CODE_FENCE: string;
  var joinEnglishList: (items: readonly string[]) => string;
  var FONT_INSTALL_PATH_SEGMENT_PATTERN: string;
  var FONT_INSTALL_PATH_PATTERN: RegExp;
  var isInstallableFontPath: (path: string) => boolean;
  var OTHER_PAGE_FONT_GUIDANCE: string;
  var SLIDES_FONT_GUIDANCE: string;
  var fontConsumptionGuide: (
    canvas: boolean,
    slides: boolean,
    fontPaths: readonly string[],
  ) => string[];
  var COLOR_DOCUMENTATION_GROUPS: M.ColorDocumentationGroup[];
  var COLOR_INTERACTION_SUFFIX_PATTERN: RegExp;
  var PALETTE_RAMP_TOKEN_PATTERN: RegExp;
  var makeApiDocumentationCard: (
    kind: string,
    name: string,
    purpose: string,
    path: string,
    lines: readonly string[],
  ) => M.ApiDocumentationCard;
  var cachedComponentApiCards: M.CachedComponentApiCards | null;
  var tokenFamilySlug: (name: string) => string;
  var assetDocumentationSlug: (name: string) => string;
  var normalizeTextNewlines: (text: string) => string;
  var LEGACY_QUICK_START_HEADING: string;
  var LEGACY_README_INSTRUCTIONS: string;
  var escapeRegexPattern: (text: string) => string;
  var README_SEPARATOR_PATTERN_SOURCE: string;
  var LEGACY_MARKDOWN_FENCE: string;
  var GENERATED_README_HEADING_PATTERN_SOURCE: string;
  var GENERATED_README_START_PATTERN: RegExp;
  var LEGACY_MANIFEST_FENCE_PATTERN_SOURCE: string;
  var LEGACY_README_SECTION_PATTERN: RegExp;
  var LEGACY_MANIFEST_FENCE_PATTERN: RegExp;
  var LEGACY_GENERATED_SECTION_PATTERN: RegExp;
  var stringFileOrNull: (files: Core.FileTable, path: string) => string | null;
  var CSS_VAR_REFERENCE_PATTERN: RegExp;
  var CSS_VAR_DECLARATION_PATTERN: RegExp;
  var CSS_PROPERTY_DECLARATION_PATTERN: RegExp;
  var firstRegexCaptureValues: (text: string, pattern: RegExp) => string[];
  var registeredCssPropertyNames: (css: string) => string[];
  var cssReadsTokensCache: M.CssReadsTokensCache[];
  var consumptionDocumentationCache: M.ConsumptionDocumentationCache[];
  function parseMarkdownFence(line: string): [string, string] {
    let indent: number = 0;
    while (indent < 3 && line.charAt(indent) === " ") {
      indent++;
    }
    let fenceCharacter = line.charAt(indent);
    if (fenceCharacter !== "`" && fenceCharacter !== "~") {
      return ["", ""];
    }
    let fenceEnd: number = indent;
    while (line.charAt(fenceEnd) === fenceCharacter) {
      fenceEnd++;
    }
    let info = line.slice(fenceEnd);
    if (fenceEnd - indent < 3 || /[\r\u2028\u2029]/.test(info)) {
      return ["", ""];
    } else {
      return [line.slice(indent, fenceEnd), info];
    }
  }
  function inspectStandaloneMigrationGuide(readme: string): {
    both: boolean;
    script: boolean;
  } {
    let [canvasPrefix, slidesPrefix] = STANDALONE_MIGRATION_PREFIXES,
      inMigrationSection: boolean = false,
      fence = "",
      sawCanvas: boolean = false,
      sawSlides = false,
      hasScript = false;
    for (let index = 0; index <= readme.length; ) {
      let value = readme.indexOf(
          `
`,
          index,
        ),
        value2 = value === -1 ? readme.length : value,
        value3 = readme.slice(
          index,
          readme.charAt(value2 - 1) === "\r" && value2 > index
            ? value2 - 1
            : value2,
        ),
        value4 = value3.trimEnd();
      index = value2 + 1;
      let [value5, value6] = parseMarkdownFence(value3);
      if (fence !== "") {
        if (
          value5 !== "" &&
          value5[0] === fence[0] &&
          value5.length >= fence.length &&
          value6.trim() === ""
        ) {
          fence = "";
        }
        continue;
      }
      if (value5 !== "" && (value5[0] !== "`" || !value6.includes("`"))) {
        fence = value5;
        continue;
      }
      if (value4.startsWith("## ") || value4.startsWith("# ")) {
        if (inMigrationSection && sawCanvas && sawSlides) {
          return {
            both: true,
            script: hasScript,
          };
        }
        inMigrationSection = value4 === STANDALONE_MIGRATION_HEADING;
        sawCanvas = false;
        sawSlides = false;
        hasScript = false;
      } else if (inMigrationSection) {
        if (value4.startsWith(canvasPrefix)) {
          sawCanvas = true;
          hasScript = hasScript || /`project\/[^`]*\.js`/.test(value4);
        }
        sawSlides = sawSlides || value4.startsWith(slidesPrefix);
      }
    }
    if (inMigrationSection && sawCanvas && sawSlides) {
      return {
        both: true,
        script: hasScript,
      };
    } else {
      return {
        both: false,
        script: false,
      };
    }
  }
  function documentationManifestFacts(
    manifest: M.RawDocManifest,
  ): M.ManifestDocumentationFacts {
    let hasFileList = Array.isArray(manifest.files),
      files = hasFileList
        ? (manifest.files as unknown[]).filter(
            (input: unknown): input is string => typeof input === "string",
          )
        : [],
      fileSet = new Set(files),
      components = Array.isArray(manifest.components)
        ? (manifest.components as (M.RawDocComponent | null | undefined)[])
            .filter(
              (input): input is M.CheckedDocComponent =>
                typeof input?.name === "string" &&
                runtime.COMPONENT_NAME_PATTERN.test(input.name),
            )
            .slice(0, MAX_DOCUMENTED_COMPONENTS)
            .map((input) => ({
              name: input.name,
              group:
                typeof input.group === "string"
                  ? sanitizeComponentGroupLabel(input.group)
                  : "",
              summary:
                typeof input.summary === "string"
                  ? sanitizeMarkdownLine(input.summary).trim()
                  : "",
              page: input.page === true,
              readme:
                !hasFileList ||
                fileSet.has(
                  runtime.DESIGN_SYSTEM_PATHS.componentsDir +
                    input.name +
                    "/README.md",
                ),
            }))
        : [],
      hasBundle =
        components.length > 0 &&
        files.includes(runtime.DESIGN_SYSTEM_PATHS.bundleJs),
      libraries = (
        Array.isArray(manifest.libraries)
          ? (manifest.libraries as (M.RawDocLibrary | null | undefined)[])
          : []
      )
        .filter(
          (input): input is M.CheckedDocLibrary =>
            typeof input?.name === "string" &&
            runtime.LIBRARY_NAME_PATTERN.test(input.name) &&
            typeof input.version === "string" &&
            runtime.LIBRARY_VERSION_PATTERN.test(input.version),
        )
        .map((input) => {
          let value: string | undefined =
            typeof input.global === "string"
              ? input.global
              : (0, runtime.findPackagedLibrary)(input.name)?.provides[0];
          return {
            name: input.name,
            version: input.version,
            file:
              typeof input.file === "string" &&
              runtime.PACKAGED_LIBRARY_PATH_PATTERN.test(input.file)
                ? input.file
                : null,
            global:
              typeof value === "string" &&
              DOCS_GLOBAL_IDENTIFIER_PATTERN.test(value)
                ? value
                : null,
          };
        });
    return {
      ns:
        typeof manifest.namespace === "string" &&
        runtime.WINDOW_NAMESPACE_PATTERN.test(manifest.namespace)
          ? manifest.namespace
          : null,
      comps: components,
      libs: libraries,
      bundle: hasBundle,
      listed: hasFileList,
      css: files.includes(runtime.DESIGN_SYSTEM_PATHS.bundleCss),
      dts: files.includes(runtime.DESIGN_SYSTEM_PATHS.indexDts),
      tokensCss:
        !hasFileList || files.includes(runtime.GENERATED_TOKENS_CSS_PATH),
      icon:
        components.find((input) => /^icons?$/i.test(input.name))?.name ?? null,
    };
  }
  function humanizeFamilyName(key: string): string {
    let humanized = key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .trim()
      .toLowerCase();
    return humanized.charAt(0).toUpperCase() + humanized.slice(1);
  }
  function generateComponentApiCards(
    declarationText: string | null,
    facts: M.ManifestDocumentationFacts,
  ): M.ComponentApiCards {
    let cacheKey = JSON.stringify([
      facts.ns,
      facts.css,
      facts.bundle,
      facts.icon,
      facts.comps,
    ]);
    if (
      cachedComponentApiCards !== null &&
      cachedComponentApiCards.dts === declarationText &&
      cachedComponentApiCards.key === cacheKey
    ) {
      return cachedComponentApiCards.out;
    }
    let qualifiedName = (input: string): string =>
        (facts.ns !== null ? facts.ns + "." : "") + input,
      lines = (declarationText ?? "").split(`
`),
      lineCount = lines.length,
      declarationPattern: RegExp =
        /^(?:export )?(?:declare )?(interface|type|const|function|class|namespace) ([A-Za-z_$][\w$]*)/,
      declarations = new Map<string, M.DocDeclarationRange[]>();
    for (let index = 0; index < lineCount; ) {
      let value = declarationPattern.exec(lines[index]);
      if (!value) {
        index++;
        continue;
      }
      let value2 = value[1],
        value3 = value[2],
        index2 = 0,
        value4 = index;
      while (value4 < lineCount) {
        let value6 = lines[value4],
          value7 = value6.trimEnd(),
          value8 = value7.trimStart();
        if (
          value4 > index &&
          (value8.startsWith("*") ||
            value8.startsWith("/*") ||
            value8.startsWith("//"))
        ) {
          value4++;
          continue;
        }
        index2 +=
          countSubstring(value6, "{") -
          countSubstring(value6, "}") +
          countSubstring(value6, "(") -
          countSubstring(value6, ")");
        if (index2 <= 0 && (value7.endsWith(";") || value7.endsWith("}"))) {
          break;
        }
        value4++;
      }
      let value5 = index;
      while (value5 > 0) {
        let value6 = lines[value5 - 1].trim();
        if (!(value6.startsWith("*") || value6.startsWith("/**"))) {
          break;
        }
        value5--;
      }
      if (!declarations.has(value3)) {
        declarations.set(value3, []);
      }
      declarations.get(value3)!.push([value2, value5, index, value4]);
      index = value4 + 1;
    }
    let firstDeclaration = (input: string) => declarations.get(input)?.[0],
      joinJSDoc = (input: readonly string[]): string => {
        let items = [];
        for (let value of input) {
          let value2 = value
            .trim()
            .replace(/^\/\*\*\s?|\*\/$|^\*\s?/g, "")
            .trim();
          if (value2) {
            items.push(value2);
          }
        }
        return items.join(" ");
      },
      declarationDoc = (input: string): string => {
        let value = firstDeclaration(input);
        if (value === undefined) {
          return "";
        } else {
          return joinJSDoc(lines.slice(value[1], value[2]));
        }
      },
      constTuples = new Map<string, string[]>(),
      typeAliases = new Map<string, string>();
    for (let [value, value2] of declarations) {
      for (let [value3, , value4, value5] of value2) {
        if (value3 === "const") {
          let value6 = /readonly \[([^\]]*)\]/.exec(
            lines.slice(value4, value5 + 1).join(`
`),
          );
          if (value6) {
            constTuples.set(
              value,
              value6[1]
                .split(",")
                .map((input) => input.trim())
                .filter((input): boolean => input !== "")
                .map((input) => input.replace(/^"+|"+$/g, "")),
            );
          }
        } else if (value3 === "type") {
          let value6 =
            /^(?:export )?(?:declare )?type [\w$]+(?:<[^\n=]*?>)? = ([^\n]+);$/.exec(
              lines
                .slice(value4, value5 + 1)
                .map((input) => input.trim())
                .filter(
                  (input) => !input.startsWith("*") && !input.startsWith("/**"),
                )
                .join(" ")
                .replace(/\/\*[\s\S]*?\*\//g, " ")
                .replace(/\s+/g, " "),
            );
          if (value6) {
            typeAliases.set(value, value6[1].trim());
          }
        }
      }
    }
    let expandType = (items: string, options = 0): string => {
        items = items.trim().replace(/import\("react"\)\./g, "React.");
        remainingWork -= items.length / 512;
        if (options > 3 || remainingWork < 0) {
          return items;
        }
        let value = /^\(typeof (\w+)\)\[number\]$/.exec(items),
          value2 = value ? constTuples.get(value[1]) : undefined;
        if (value2) {
          return value2.map((input): string => '"' + input + '"').join(" | ");
        }
        let value3 = items !== "IconName" ? typeAliases.get(items) : undefined;
        if (value3 !== undefined && unicodeCharacterCount(value3) < 400) {
          let value5 = expandType(value3, options + 1);
          if (unicodeCharacterCount(value5) > 1400) {
            return items;
          } else {
            return value5;
          }
        }
        let value4 = /^(Exclude|Extract)<([\s\S]+)>$/.exec(items);
        if (value4 !== null) {
          let [value5, value6] = splitAtDepthZero(value4[2], ","),
            callback = (input: string) =>
              /^(?:"[^"]*"|-?\d[\d.]*|true|false|null|undefined)(?:\s*\|\s*(?:"[^"]*"|-?\d[\d.]*|true|false|null|undefined))*$/.test(
                input,
              ),
            value7 =
              value5 !== undefined ? expandType(value5, options + 1) : "",
            value8 =
              value6 !== undefined ? expandType(value6, options + 1) : "";
          if (callback(value7) && callback(value8)) {
            let values = new Set(splitAtDepthZero(value8, "|")),
              value9 = splitAtDepthZero(value7, "|").filter(
                (input): boolean =>
                  (value4[1] === "Exclude") !== values.has(input),
              );
            if (value9.length > 0) {
              return value9.join(" | ");
            }
          }
          return items;
        }
        if (items.startsWith("Omit<")) {
          return items;
        }
        if (
          items.includes("|") &&
          !items.includes("(") &&
          !items.includes("{") &&
          !items.includes("<")
        ) {
          let value5 = items.split("|").map((input) => input.trim());
          return uniqueValues(
            value5.map((input) =>
              /^[A-Z]\w+$/.test(input) ? expandType(input, options + 1) : input,
            ),
          ).join(" | ");
        }
        return items;
      },
      propertyPattern: RegExp =
        /^\s*(?:readonly )?"?([\w\-]+)"?(\?)?:\s*([\s\S]*?);?\s*$/,
      methodPattern: RegExp =
        /^\s*(?:readonly )?"?([\w\-]+)"?(\?)?(\([\s\S]*);?\s*$/,
      omittedStandardProps = new Set([
        "className",
        "data-testid",
        "style",
        "ref",
        "key",
      ]),
      keepAllProps = new Set<string>(),
      maxUnionArms: number = 32,
      maxProps: number = 160,
      maxTypeTextLength: number = 700,
      externalTypePattern: RegExp =
        /^(?:HTML\w*|React|(?:Omit|Pick|Partial|Readonly|Record|Array|ReadonlyArray|Required|NonNullable|Exclude|Extract|Parameters|ReturnType)(?![\w$]))/,
      identifierPattern: RegExp = /^[A-Za-z_$][\w$]*$/,
      importsByAlias = new Map<string, M.DocImportName>();
    for (let value of lines.slice(0, 200)) {
      let value2 = /^import (?:type )?\{([^}]*)\} from "([^"]+)"/.exec(value);
      if (value2) {
        for (let value3 of value2[1].split(",")) {
          let value4 = /^\s*([\w$]+)(?:\s+as\s+([\w$]+))?\s*$/.exec(value3);
          if (value4) {
            importsByAlias.set(value4[2] ?? value4[1], {
              name: value4[1],
              from: value2[2],
            });
          }
        }
      }
    }
    let describeExternalType = (input: string, options = 0): string => {
        let value = input.replace(
          /\bimport\("([^"]+)"\)\.([\w$.]+)/g,
          (input2: string, options2: string, context: string): string =>
            context + " (" + options2 + ")",
        );
        value = value.replace(
          /\bComponentProps(?:WithoutRef|WithRef)?<typeof ([\w$.]+)>/g,
          (input2: string, options2: string): string => options2 + " props",
        );
        value = value.replace(
          /\b([A-Za-z_][\w]*(?:\$\d+)?)((?:\.[\w$]+)*)(?![\w$])/g,
          (input2: string, options2: string, context: string) => {
            let entry = importsByAlias.get(options2);
            if (entry !== undefined) {
              if (context !== "" || /\$\d+$/.test(options2)) {
                return entry.name + context + " (" + entry.from + ")";
              } else {
                return input2;
              }
            }
            if (options < 2 && firstDeclaration(options2)?.[0] === "type") {
              let value2 = (typeAliases.get(options2) ?? "").trim();
              if (
                value2 !== "" &&
                /^[\w$]+(?:\.[\w$]+)*(?:<[^<>]*>)?$|^ComponentProps/.test(
                  value2,
                ) &&
                [...importsByAlias.keys()].some((input3) =>
                  new RegExp("\\b" + input3.replace(/\$/g, "\\$") + "\\b").test(
                    value2,
                  ),
                )
              ) {
                return describeExternalType(value2, options + 1) + context;
              }
            }
            if (/\$\d+$/.test(options2)) {
              return options2.replace(/\$\d+$/, "") + context;
            } else {
              return input2;
            }
          },
        );
        return value;
      },
      exportsByName = new Map<string, string>();
    for (let [value, value2] of declarations) {
      if (value2.some((input) => lines[input[2]].startsWith("export "))) {
        exportsByName.set(value, value);
      }
    }
    for (let value of lines) {
      if (!value.startsWith("export {")) {
        continue;
      }
      for (let value2 of value.replace(/^export \{|\};?\s*$/g, "").split(",")) {
        let value3 = /^\s*(?:type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?\s*$/.exec(
          value2,
        );
        if (value3) {
          exportsByName.set(value3[1], value3[2] ?? value3[1]);
        }
      }
    }
    let hasExportList: boolean = exportsByName.size > 0,
      splitAtDepthZero = (items: string, options: string) => {
        let items2 = [],
          index: number = 0,
          index2 = 0;
        for (let index3: number = 0; index3 < items.length; index3++) {
          let value = items[index3];
          if (
            value === "<" ||
            value === "(" ||
            value === "[" ||
            value === "{"
          ) {
            index++;
          } else if (
            (value === ">" && items[index3 - 1] !== "=") ||
            value === ")" ||
            value === "]" ||
            value === "}"
          ) {
            index = Math.max(0, index - 1);
          } else if (value === options && index === 0) {
            items2.push(items.slice(index2, index3));
            index2 = index3 + 1;
          }
        }
        items2.push(items.slice(index2));
        return items2
          .map((input) => input.trim())
          .filter((input): boolean => input !== "");
      },
      splitTypeArguments = (input: string) => splitAtDepthZero(input, ","),
      findTopLevelDelimiter = (items: string, options: string): number => {
        let index: number = 0;
        for (let index2: number = 0; index2 < items.length; index2++) {
          let value = items[index2];
          if (
            value === "<" ||
            value === "(" ||
            value === "[" ||
            value === "{"
          ) {
            index++;
          } else if (
            (value === ">" && items[index2 - 1] !== "=") ||
            value === ")" ||
            value === "]" ||
            value === "}"
          ) {
            index = Math.max(0, index - 1);
          } else if (
            value === options &&
            index === 0 &&
            items[index2 + 1] !== ">"
          ) {
            return index2;
          }
        }
        return -1;
      },
      isWrappedExpression = (items: string): boolean => {
        let index: number = 0;
        for (let index2: number = 0; index2 < items.length; index2++) {
          let value = items[index2];
          if (value === "(") {
            index++;
          } else if (value === ")") {
            index--;
            if (index === 0 && index2 < items.length - 1) {
              return false;
            }
          }
        }
        return index === 0;
      },
      unwrap = (input: string) => {
        let value = input.trim();
        for (
          let index: number = 0;
          index < 8 &&
          value.startsWith("(") &&
          value.endsWith(")") &&
          isWrappedExpression(value);
          index++
        ) {
          value = value.slice(1, -1).trim();
        }
        return value;
      },
      mergeUnion = (input: string, options: string) => {
        let values = new Set(
          [
            ...splitAtDepthZero(input, "|"),
            ...splitAtDepthZero(options, "|"),
          ].filter((input2): boolean => input2 !== "never"),
        );
        if (
          (values.has("true") && values.has("false")) ||
          values.has("boolean")
        ) {
          values.delete("true");
          values.delete("false");
          values.add("boolean");
        }
        return [...values].join(" | ");
      },
      summarizeInlineObject = (items: string): string =>
        (remainingWork -= items.length / 512) < 0
          ? truncateUnicodeText(items, 80) + "…"
          : splitAtDepthZero(items, "|")
              .map((input) => {
                let value = input.trim();
                if (!(value.startsWith("{") && value.endsWith("}"))) {
                  return expandType(value);
                }
                return (
                  "{ " +
                  splitAtDepthZero(value.slice(1, -1), ";")
                    .map((input2): null | string => {
                      let value2 =
                        /^(?:readonly )?"?([\w\-]+)"?(\??):\s*([\s\S]*)$/.exec(
                          input2.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
                        );
                      if (value2 === null) {
                        return null;
                      }
                      let value3 = expandType(value2[3].replace(/\s+/g, " "));
                      return (
                        value2[1] +
                        value2[2] +
                        (unicodeCharacterCount(value3) <= 32
                          ? ": " + value3
                          : "")
                      );
                    })
                    .filter((input2): boolean => input2 !== null)
                    .join("; ") +
                  " }"
                );
              })
              .join(" | "),
      parsePropRows = (
        input: readonly string[],
        options: ReadonlySet<string>,
      ): M.DocPropRow[] => {
        let items: M.DocPropRow[] = [],
          items2: string[] = [],
          items3: string[] = [],
          index = 0,
          index2: number = 0;
        for (let value of input) {
          let value2 = value.trim(),
            value3 =
              items3.length === 0
                ? /^\/\*\*([\s\S]*?)\*\/\s*(?=\S)/.exec(value2)
                : null;
          if (value3 !== null) {
            items2 = [value3[1]];
            value2 = value2.slice(value3[0].length);
            value = "  " + value2;
          }
          if (
            items3.length === 0 &&
            (value2.startsWith("/**") ||
              value2.startsWith("*") ||
              value2.startsWith("//"))
          ) {
            if (!value2.startsWith("//")) {
              items2.push(value2);
            }
            continue;
          }
          if (
            items3.length === 0 &&
            (value2 === "" || /^[})\]|&,;({]*$/.test(value2))
          ) {
            items2 = [];
            index = 0;
            continue;
          }
          items3.push(value);
          index +=
            countSubstring(value, "{") +
            countSubstring(value, "(") +
            countSubstring(value, "[") -
            countSubstring(value, "}") -
            countSubstring(value, ")") -
            countSubstring(value, "]");
          if (index > 0 && items3.length < 80) {
            continue;
          }
          let value4 = items3.join(`
`);
          items3 = [];
          index = 0;
          let value5 = joinJSDoc(items2).replace(/\s+/g, " ");
          items2 = [];
          if (++index2 > maxProps * 4) {
            break;
          }
          let value6 = propertyPattern.exec(value4),
            value7 = value6 === null ? methodPattern.exec(value4) : null;
          if (value6 === null && value7 === null) {
            continue;
          }
          let value8 = (value6 ?? value7)![1],
            value9: boolean = (value6 ?? value7)![2] !== undefined,
            value10 =
              value6 !== null
                ? value6[3].replace(/\s*\n\s*/g, " ").trim()
                : value7![3]
                    .replace(/;\s*$/, "")
                    .replace(/\s*\n\s*/g, " ")
                    .replace(/\):\s*/, ") => ");
          if (
            options.has(value8) ||
            value10 === "never" ||
            value5.includes("@internal")
          ) {
            continue;
          }
          let value11 = value10.includes("{")
            ? summarizeInlineObject(
                truncateUnicodeText(value10, maxTypeTextLength * 2),
              )
            : expandType(truncateUnicodeText(value10, maxTypeTextLength * 2));
          items.push([
            value8,
            value9 ? "" : "*",
            unicodeCharacterCount(value11) > maxTypeTextLength
              ? truncateUnicodeText(value11, maxTypeTextLength) + "…"
              : value11,
            unicodeCharacterCount(value5) > maxTypeTextLength
              ? truncateUnicodeText(value5, maxTypeTextLength) + "…"
              : value5,
          ]);
          if (items.length >= maxProps) {
            break;
          }
        }
        return items;
      },
      variantPropRows = (input: string): M.DocPropRow[] => {
        let value = (declarations.get(input) ?? []).find(
          (input2): boolean => input2[0] === "const",
        );
        if (
          value === undefined ||
          !/\(props\?: \(\{\s*$/.test(lines[value[2]])
        ) {
          return [];
        }
        let value2 = lines.slice(value[2] + 1, value[3] + 1);
        if (!chargeLines(value2)) {
          return [];
        }
        return parsePropRows(value2, keepAllProps).map((input2) => [
          input2[0],
          "",
          splitAtDepthZero(input2[2], "|")
            .filter((input3) => input3 !== "null" && input3 !== "undefined")
            .join(" | "),
          input2[3],
        ]);
      },
      maxWork: number = 20000,
      remainingWork = maxWork,
      tooWide: boolean = false,
      wideTypeSentinel: string = "\x00wide",
      chargeLines = (items: readonly string[]): boolean => {
        let index = 0;
        for (let value of items) {
          index += value.length;
        }
        remainingWork -= index / 512 + items.length / 8;
        return remainingWork >= 0;
      },
      resolvePropExpression = (
        input: string,
        options: Set<string>,
        context: ReadonlySet<string>,
        value: string[],
      ): M.DocPropRow[] => {
        if (--remainingWork < 0) {
          tooWide = true;
          return [];
        }
        let value2 = unwrap(input.trim()),
          value3 = uniqueValues(splitAtDepthZero(value2, "|"));
        if (value3.length > maxUnionArms) {
          tooWide = true;
          return [];
        }
        if (value3.length > 1) {
          let value12 = value3.map((input2) =>
            resolvePropExpression(
              input2,
              new Set(options),
              context,
              value,
            ).slice(0, maxProps),
          );
          if (value12.every((items): boolean => items.length === 0)) {
            return [];
          }
          let value13 = uniqueValues(
            value12.flat().map((input2) => input2[0]),
          ).slice(0, maxProps);
          remainingWork -= (value13.length * value12.length * maxProps) / 4096;
          if (remainingWork < 0) {
            tooWide = true;
            return [];
          }
          return value13.map((input2) => {
            let value14 = value12
                .map((input3) =>
                  input3.find((input4): boolean => input4[0] === input2),
                )
                .filter(
                  (input3): input3 is M.DocPropRow => input3 !== undefined,
                ),
              value15: boolean =
                value14.length ===
                value12.filter((items): boolean => items.length > 0).length;
            return [
              input2,
              value15 && value14.every((input3): boolean => input3[1] === "*")
                ? "*"
                : "",
              value14.map((input3) => input3[2]).reduce(mergeUnion),
              value14.find((input3): boolean => input3[3] !== "")?.[3] ?? "",
            ];
          });
        }
        let value4 = splitAtDepthZero(value2, "&").map(unwrap);
        if (value4.length > 1) {
          return mergePropRows(
            value4.flatMap((input2) =>
              resolvePropExpression(input2, options, context, value).map(
                (input3) => [input3, "own"],
              ),
            ),
          );
        }
        let value5 = value4[0] ?? "";
        if (value5.startsWith("{")) {
          let value12 = value5.slice(1, value5.lastIndexOf("}"));
          return parsePropRows(
            value12.includes(`
`)
              ? value12.split(`
`)
              : splitAtDepthZero(value12, ";").map(
                  (input2): string => "  " + input2 + ";",
                ),
            context,
          );
        }
        if (value5 !== value2 && value5.includes("|")) {
          return resolvePropExpression(value5, options, context, value);
        }
        let value6 = /^VariantProps<typeof ([\w$]+)>$/.exec(value5);
        if (value6 !== null) {
          return variantPropRows(value6[1]);
        }
        let value7 =
            /^(\w*Omit|Pick|Partial|Readonly|Required)<\s*([A-Za-z_$][\w$]*)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*(?:,([\s\S]*))?>$/.exec(
              value5,
            ),
          value8 = value7 !== null ? value7[2] : value5.split("<")[0].trim(),
          value9 = identifierPattern.test(value8)
            ? firstDeclaration(value8)?.[0]
            : undefined;
        if (
          !(value9 === "interface" || value9 === "type") ||
          externalTypePattern.test(value8)
        ) {
          if (/^[A-Za-z_$][\w$.]*(?:<[\s\S]*>)?(?:\[[^\]]*\])?$/.test(value5)) {
            value.push(value5);
          }
          return [];
        }
        let [value10, value11] = resolveNamedProps(value8, options, context);
        if (value7 !== null && value10.length === 0) {
          value.push(value5);
          return [];
        }
        if (value7 !== null) {
          let values = new Set(
            [...(value7[3] ?? "").matchAll(/"([^"]+)"/g)].map(
              (input2) => input2[1],
            ),
          );
          if (value7[1].endsWith("Omit")) {
            value10 = value10.filter(
              (input2): boolean => !values.has(input2[0]),
            );
          } else if (value7[1] === "Pick") {
            value10 = value10.filter((input2) => values.has(input2[0]));
          } else if (value7[1] === "Partial") {
            value10 = value10.map((input2) => [
              input2[0],
              "",
              input2[2],
              input2[3],
            ]);
          }
        }
        value.push(...value11);
        return value10;
      },
      mergePropRows = (input: readonly M.DocPropOrigin[]): M.DocPropRow[] => {
        let entries = new Map<string, M.DocPropRow>();
        for (let [value] of input) {
          let entry = entries.get(value[0]);
          entries.set(
            value[0],
            entry === undefined
              ? value
              : [value[0], value[1], value[2], value[3] || entry[3]],
          );
        }
        return [...entries.values()];
      },
      resolveNamedProps = (
        input: string,
        options = new Set<string>(),
        context: ReadonlySet<string> = omittedStandardProps,
      ): M.DocResolvedProps => {
        let value = firstDeclaration(input);
        if (options.size === 0) {
          tooWide = false;
        }
        if (options.has(input) || value === undefined || options.size > 40) {
          return [[], [], null];
        }
        if (--remainingWork < 0) {
          return [[], [], wideTypeSentinel];
        }
        options.add(input);
        let items: string[] = [],
          value2 = lines.slice(value[2], value[3] + 1);
        if (!chargeLines(value2)) {
          return [[], [], wideTypeSentinel];
        }
        let value3 = value2[0].replace(
            new RegExp(
              "^((?:export )?(?:declare )?(?:interface|type) " +
                input.replace(/\$/g, "\\$") +
                ")<(?:[^<>]|<[^<>]*>)*>",
            ),
            "$1",
          ),
          value4: M.DocPropRow[];
        if (value[0] === "type") {
          let value7 = [value3, ...value2.slice(1)].join(`
`);
          value4 = resolvePropExpression(
            value7
              .slice(findTopLevelDelimiter(value7, "=") + 1)
              .replace(/;\s*$/, ""),
            options,
            context,
            items,
          );
        } else {
          let items2: M.DocPropOrigin[] = [];
          for (let value8 of value3.matchAll(/\bextends ([^{]+)\{/g)) {
            for (let value9 of splitTypeArguments(value8[1])) {
              items2.push(
                ...resolvePropExpression(value9, options, context, items).map(
                  (input2): M.DocPropOrigin => [input2, "base"],
                ),
              );
            }
          }
          let value7 =
            value2.length === 1
              ? /\{([^{}]*)\}\s*\)?;?\s*$/.exec(value3)
              : null;
          items2.push(
            ...parsePropRows(
              value7 !== null
                ? value7[1]
                    .split(";")
                    .map((input2): string => "  " + input2.trim() + ";")
                : value2.slice(1),
              context,
            ).map((input2): M.DocPropOrigin => [input2, "own"]),
          );
          value4 = mergePropRows(items2);
        }
        if (value4.length > maxProps) {
          value4 = value4.slice(0, maxProps);
        }
        let value5 =
            value4.length === 0 && !tooWide
              ? value2.map((input2) => input2.trim()).join(" ")
              : "",
          value6 =
            tooWide && value4.length === 0
              ? wideTypeSentinel
              : value[0] === "type" &&
                  value4.length === 0 &&
                  !value5.includes("{")
                ? value5
                    .slice(findTopLevelDelimiter(value5, "=") + 1)
                    .replace(/;\s*$/, "")
                    .trim() || null
                : null;
        return [value4, uniqueValues(items), value6];
      },
      propsNamePattern: RegExp =
        /\b((?:import\("[^"]+"\)\.)?[A-Z][\w$]*(?:\.[A-Z][\w$]*)*?(?:\.Props|Props(?:\$\d+)?))\b/,
      componentPropsType = (input: string): string | null => {
        if (declarations.has(input + "Props")) {
          return input + "Props";
        }
        if (declarations.has(input + "RootProps")) {
          return input + "RootProps";
        }
        for (let value of declarations.get(input) ?? []) {
          if (value[0] !== "function" && value[0] !== "const") {
            continue;
          }
          let value2 =
            value[0] === "function"
              ? lines.slice(value[2], value[3] + 1).join(`
`)
              : lines[value[2]].includes("{")
                ? lines[value[2]].slice(0, lines[value[2]].indexOf("{"))
                : lines[value[2]];
          for (let value4 of value2.matchAll(
            /\b([A-Z][\w$]*Props(?:\$\d+)?)\b(?!\.)/g,
          )) {
            let value5 = firstDeclaration(value4[1])?.[0];
            if (value5 === "interface" || value5 === "type") {
              return value4[1];
            }
          }
          let value3 = propsNamePattern.exec(
            value2.replace(/RefAttributes<[^>]*>/g, ""),
          )?.[1];
          if (
            value3 !== undefined &&
            firstDeclaration(value3) === undefined &&
            /[.$]|^import/.test(value3) &&
            !/^(?:import\("react"\)|React)\./.test(value3) &&
            inlineComponentProps(input).length === 0
          ) {
            return value3;
          }
        }
        return null;
      },
      wrappedComponentType = (input: string): string | null => {
        for (let value of declarations.get(input) ?? []) {
          if (value[0] !== "const") {
            continue;
          }
          let value2 = /:\s*typeof ([\w$]+)\s*&/.exec(lines[value[2]]);
          if (value2) {
            return value2[1];
          }
        }
        return null;
      },
      inlineComponentProps = (
        input: string,
        options?: readonly string[],
      ): M.DocPropRow[] => {
        let value = (declarations.get(input) ?? []).find(
            (input2) => input2[0] === "function" || input2[0] === "const",
          ),
          value2 =
            options ??
            (value === undefined ? [] : lines.slice(value[2], value[3] + 1));
        if (value2.length === 0) {
          return [];
        }
        if (
          options === undefined &&
          /^(?:export )?declare const [\w$]+:\s*(?:typeof [\w$]+\s*&\s*)?\{\s*$/.test(
            value2[0].trim(),
          )
        ) {
          return [];
        }
        let value3 =
          value2.length === 1
            ? /[)}\w>]\s*[:&<]\s*\{([^{}]*)\}\s*[)>&]/.exec(value2[0])
            : null;
        if (value3 !== null) {
          return parsePropRows(
            value3[1]
              .split(";")
              .map((input2): string => "  " + input2.trim() + ";"),
            omittedStandardProps,
          );
        }
        let value4 = value2.findIndex(
          (input2: string, options2: number) =>
            /(?:\}\s*:|\bprops\??\s*:|&|<)\s*\{\s*$/.test(input2) &&
            !(
              options2 === 0 &&
              /^(?:export )?declare const \w+: \{\s*$/.test(input2.trim())
            ),
        );
        if (value4 === -1) {
          return [];
        }
        let index = 0,
          value5 = value4 + 1;
        for (let value6 = value4; value6 < value2.length; value6++) {
          index +=
            countSubstring(value2[value6], "{") -
            countSubstring(value2[value6], "}");
          if (value6 > value4 && index <= 0) {
            value5 = value6;
            break;
          }
          value5 = value6 + 1;
        }
        return parsePropRows(
          value2.slice(value4 + 1, value5),
          omittedStandardProps,
        );
      },
      componentParts = (input: string): M.DocComponentParts => {
        let callback = (
          input2: string,
          options: readonly string[] | null,
        ): [string | null, M.DocPropRow[] | null] => {
          let value3 = /\btypeof ([\w$]+(?:\.[\w$]+)*)/.exec(input2)?.[1];
          if (value3 !== undefined && value3.includes(".")) {
            return [value3 + ".Props", null];
          }
          let value4 = value3,
            value5 = value4 !== undefined ? componentPropsType(value4) : null,
            value6 =
              value4 !== undefined
                ? ""
                : input2.replace(/RefAttributes<[^>]*>/g, "");
          if (value4 === undefined && /^\s*\(/.test(input2)) {
            let value11 = (options ?? [input2]).join(`
`),
              value12 =
                /\(\s*[\w$]+\s*:\s*([A-Z][\w$.]*(?:<[^>]*>)?)\s*\)\s*=>/.exec(
                  value11,
                )?.[1];
            if (value12 !== undefined) {
              return [value12, null];
            }
            if (/^\s*\(\s*\)\s*=>/.test(input2)) {
              return [null, []];
            }
            return [
              null,
              options !== null
                ? inlineComponentProps("", options)
                : inlineComponentProps("", [
                    input2.replace(
                      /^(\s*\([^)]*?:\s*\{)/,
                      "declare function x(p: {",
                    ),
                  ]),
            ];
          }
          let value7 =
              /(?<![").$\w])\b([A-Z][\w$]*Props(?:\$\d+)?)\b(?!\.)/.exec(
                value6,
              )?.[1],
            value8 =
              (value7 !== undefined && firstDeclaration(value7) !== undefined
                ? value7
                : undefined) ??
              value5 ??
              propsNamePattern.exec(value6)?.[1] ??
              value7 ??
              (/^\s*[\w$]+\$\d+(?:\.[A-Z][\w$]*)+\s*[;&]/.test(input2)
                ? input2.trim().replace(/\s*[;&][\s\S]*$/, "") + ".Props"
                : undefined),
            value9 =
              options !== null &&
              /(?:Component|FC|ComponentType)<[^{]*\{\s*$/.test(options[0])
                ? options
                : null;
          if (value8 !== null && value8 !== undefined) {
            if (value9 === null || firstDeclaration(value8) === undefined) {
              return [value8, null];
            }
            let value11 = inlineComponentProps("", value9);
            if (value11.length === 0) {
              return [value8, null];
            }
            return [
              null,
              [
                ...resolveNamedProps(value8)[0].filter(
                  (input3): boolean =>
                    !value11.some((input4): boolean => input4[0] === input3[0]),
                ),
                ...value11,
              ],
            ];
          }
          let value10 =
            value4 !== undefined
              ? inlineComponentProps(value4)
              : value9 !== null
                ? inlineComponentProps("", value9)
                : [];
          return [
            null,
            value10.length > 0 || value9 !== null || value4 !== undefined
              ? value10
              : null,
          ];
        };
        for (let [value3, , value4, value5] of declarations.get(input) ?? []) {
          if (value3 !== "const") {
            continue;
          }
          let value6 = lines[value4],
            value7 = /:\s*typeof [\w$]+\s*&|:\s*\(/.test(value6);
          if (
            !/^(?:export )?declare const \w+: \{/.test(value6) &&
            !value6.includes("& {")
          ) {
            continue;
          }
          let items: M.DocComponentPart[] = [],
            index = 0,
            value8 = lines.slice(value4, value5 + 1);
          for (let index2: number = 0; index2 < value8.length; index2++) {
            let value9 = value8[index2],
              value10 = index;
            index += countSubstring(value9, "{") - countSubstring(value9, "}");
            let value11 =
              value10 === 1
                ? /^\s+(?:readonly )?([A-Z]\w*)\??:/.exec(value9)
                : null;
            if (value11 === null) {
              continue;
            }
            let value12 = index2;
            if (index > 1) {
              let value15 = index;
              for (
                value12 = index2 + 1;
                value12 < value8.length && value15 > 1;
                value12++
              ) {
                value15 +=
                  countSubstring(value8[value12], "{") -
                  countSubstring(value8[value12], "}");
              }
              value12--;
            }
            let [value13, value14] = callback(
              value9.slice(value11[0].length),
              value12 > index2 ? value8.slice(index2, value12 + 1) : null,
            );
            items.push([value11[1], value13, value14]);
          }
          return {
            parts: items,
            callable: value7,
          };
        }
        let value = [...exportsByName].find(
            ([input2, input3]) => input3 === input && input2 !== input,
          )?.[0],
          value2 =
            value !== undefined
              ? (declarations.get(value) ?? []).find(
                  (input2): boolean => input2[0] === "namespace",
                )
              : undefined;
        if (value2 !== undefined) {
          let items: M.DocComponentPart[] = [];
          for (let value3 of lines.slice(value2[2], value2[3] + 1)) {
            let value4 = /^\s*export \{([^}]*)\}/.exec(value3);
            if (value4 === null) {
              continue;
            }
            for (let value5 of value4[1].split(",")) {
              let value6 = /^\s*([\w$]+)\s+as\s+([A-Z][\w$]*)\s*$/.exec(value5);
              if (value6 === null) {
                continue;
              }
              let value7 = firstDeclaration(value6[1])?.[0];
              if (
                value7 === "const" ||
                value7 === "function" ||
                value7 === "class"
              ) {
                items.push([
                  value6[2],
                  componentPropsType(value6[1]),
                  componentPropsType(value6[1]) === null
                    ? inlineComponentProps(value6[1])
                    : null,
                ]);
              }
            }
          }
          if (items.length > 0) {
            return {
              parts: items,
              callable: false,
            };
          }
        }
        return {
          parts: [],
          callable: true,
        };
      },
      documentedComponentNames = new Set(
        facts.comps.map((input) => input.name),
      ),
      isComponentDeclaration = (input: string) =>
        (declarations.get(input) ?? []).some(
          (input2) =>
            (input2[0] === "function" &&
              /\):\s*(?:React\.|import\("react"\)\.)?(?:JSX\.Element|ReactElement|ReactNode)/.test(
                lines.slice(input2[2], input2[3] + 1).join(" "),
              )) ||
            (input2[0] === "const" &&
              /(?:ForwardRefExoticComponent|FC|FunctionComponent|NamedExoticComponent|MemoExoticComponent|ComponentType)</.test(
                lines[input2[2]],
              )) ||
            input2[0] === "class",
        ),
      relatedComponents = (items: string) =>
        [...declarations.keys()]
          .filter(
            (input) =>
              input.startsWith(items) &&
              input !== items &&
              /^[A-Z]/.test(input.slice(items.length)) &&
              !input.endsWith("Props") &&
              !documentedComponentNames.has(input) &&
              !/(?:Context|Provider|Variants)$/.test(input),
          )
          .filter(
            (input) =>
              (hasExportList ? exportsByName.get(input) === input : true) &&
              isComponentDeclaration(input),
          )
          .slice(0, 12),
      maxRefinedEnumOptions: number = 40,
      refinementBudget: number = Math.max(
        48,
        Math.floor(400000000 / Math.max(1, (declarationText ?? "").length)),
      ),
      refineEnumProps = (
        input: string,
        items: M.DocPropRow[],
      ): M.DocPropRow[] => {
        if (
          items.length === 0 ||
          !/Props(?:\$\d+)?$/.test(input) ||
          refinementBudget <= 0
        ) {
          return items;
        }
        let value: string = `(?:"[^"]*"|'[^']*'|-?\\d[\\d.]*|true|false|null|undefined|string|number|boolean|ReactNode|ReactElement|React\\.\\w+|IconName|Date|CSSProperties)(?:\\[\\])?`,
          value2 = new RegExp(
            "^(?:" +
              value +
              "(?:\\s*\\|\\s*" +
              value +
              ")*|\\([\\s\\S]*|\\{[\\s\\S]*)$",
          );
        if (items.every((input2) => value2.test(input2[2]))) {
          return items;
        }
        let value3: Core.InferredPropControl[];
        try {
          refinementBudget--;
          value3 = (0, runtime.inferComponentPropControls)(
            input.replace(/Props(?:\$\d+)?$/, ""),
            [declarationText ?? ""],
            {
              keep: items.map((input2) => input2[0]),
            },
          );
          if ((0, runtime.wasTypeInferenceIncomplete)()) {
            refinementBudget = 0;
          }
        } catch {
          refinementBudget = 0;
          return items;
        }
        let entries = new Map(value3.map((input2) => [input2.name, input2]));
        return items.map((input2) => {
          if (value2.test(input2[2])) {
            return input2;
          }
          let entry = entries.get(input2[0]);
          if (
            entry === undefined ||
            entry.kind !== "enum" ||
            entry.options === undefined ||
            entry.options.length === 0 ||
            entry.options.length > maxRefinedEnumOptions
          ) {
            return input2;
          }
          let value4 = splitAtDepthZero(input2[2], "|"),
            value5 = value4.filter((input3) => /^"[^"]*"$/.test(input3)),
            value6 = entry.options.map((input3) =>
              entry.numeric === true ||
              (entry.withBool === true &&
                (input3 === "true" || input3 === "false"))
                ? input3
                : '"' + input3 + '"',
            );
          if (
            value5.length > 0 &&
            (value5.length <
              value4.filter(
                (input3): boolean =>
                  !/^(?:string|number|boolean|true|false|null|undefined)$/.test(
                    input3,
                  ),
              ).length ||
              !value5.every((input3) => value6.includes(input3)))
          ) {
            return input2;
          }
          if (
            /\bstring\b/.test(input2[2]) ||
            /string\s*&/.test(typeAliases.get(input2[2]) ?? "")
          ) {
            value6.push("string");
          }
          return [input2[0], input2[1], value6.join(" | "), input2[3]];
        });
      },
      kebabPropName = (input: string) =>
        input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
      maxExampleLength: number = 600,
      componentExamples = (
        items: string,
        options: M.DocPropRow[],
        context: string,
        value = "",
        extra = new Set<string>(),
      ): [string, string] => {
        let value2 = items.replace(/\$/g, "\\$"),
          value3 = qualifiedName(items) + value,
          callback = (): [string, string] => {
            let value14 = options
                .filter((input) => input[1] === "*" && input[0] !== "children")
                .slice(0, 3),
              value15 = value14
                .map(([input, , input2]): string => {
                  let value18 = /^"[^"]*"/.exec(input2.trim());
                  return (
                    " " +
                    input +
                    (value18
                      ? "=" + value18[0]
                      : input2 === "string"
                        ? '="…"'
                        : input2 === "number"
                          ? "={0}"
                          : input2 === "boolean" || input2 === "true"
                            ? ""
                            : "={…}")
                  );
                })
                .join(""),
              value16 = value14
                .map(([input, , input2]): string => {
                  let value18 = /^"[^"]*"/.exec(input2.trim());
                  return (
                    " " +
                    kebabPropName(input) +
                    "=" +
                    (value18
                      ? value18[0]
                      : input2 === "string"
                        ? '"…"'
                        : input2 === "number"
                          ? '"{{0}}"'
                          : input2 === "boolean" || input2 === "true"
                            ? '"{{yes}}"'
                            : '"{{…}}"')
                  );
                })
                .join(""),
              value17 =
                value !== "" ||
                options.some((input): boolean => input[0] === "children");
            return [
              value17
                ? "<" + value3 + value15 + ">…</" + value3 + ">"
                : "<" + value3 + value15 + " />",
              '<x-import component-from-global-scope="' +
                value3 +
                '"' +
                value16 +
                ">" +
                (value17 ? "…" : "") +
                "</x-import>",
            ];
          },
          value4 = context.includes("@example")
            ? context.slice(context.indexOf("@example"))
            : context,
          value5 = new RegExp("<" + value2 + "(\\.\\w+)?(?=[\\s/>])").exec(
            value4,
          );
        if (value5 === null) {
          return callback();
        }
        let value6 = value5[1] ?? "",
          value7 = value4.slice(
            value5.index,
            value5.index + maxExampleLength * 4,
          ),
          value8 = 1 + items.length + value6.length,
          items2: [string, string | undefined][] = [],
          flag: boolean = false;
        for (;;) {
          while (value8 < value7.length && /\s/.test(value7[value8])) {
            value8++;
          }
          if (value7[value8] === ">") {
            value8++;
            break;
          }
          if (value7[value8] === "/" && value7[value8 + 1] === ">") {
            flag = true;
            value8 += 2;
            break;
          }
          let value14 = /^[A-Za-z][\w-]*/.exec(value7.slice(value8));
          if (value14 === null) {
            return callback();
          }
          value8 += value14[0].length;
          let value15: string | undefined;
          if (value7[value8] === "=") {
            if ((value8++, value7[value8] === '"')) {
              let value16 = value7.indexOf('"', value8 + 1);
              if (value16 === -1) {
                return callback();
              }
              value15 = value7.slice(value8, value16 + 1);
              value8 = value16 + 1;
            } else if (value7[value8] === "{") {
              let index: number = 0,
                value16 = value8,
                text2 = "";
              for (; value16 < value7.length; value16++) {
                let value17 = value7[value16];
                if (text2 !== "") {
                  if (value17 === text2) {
                    text2 = "";
                  }
                  continue;
                }
                if (value17 === '"' || value17 === "'" || value17 === "`") {
                  text2 = value17;
                } else if (value17 === "{") {
                  index++;
                } else if (value17 === "}" && --index === 0) {
                  break;
                }
              }
              if (value16 >= value7.length) {
                return callback();
              }
              value15 = value7.slice(value8, value16 + 1);
              value8 = value16 + 1;
            } else {
              return callback();
            }
          }
          items2.push([value14[0], value15]);
          if (items2.length > 24 || value8 >= value7.length) {
            return callback();
          }
        }
        let text = "";
        if (!flag) {
          let value14: string = "<" + items + value6,
            value15: string = "</" + items + value6 + ">",
            count: number = 1,
            value16 = value8;
          for (;;) {
            let value17 = value7.indexOf(value14, value16),
              value18 = value7.indexOf(value15, value16);
            if (value18 === -1) {
              return callback();
            }
            if (
              value17 !== -1 &&
              value17 < value18 &&
              /[\s/>]/.test(value7[value17 + value14.length] ?? "")
            ) {
              count++;
              value16 = value17 + value14.length;
              continue;
            }
            if (--count === 0) {
              text = value7.slice(value8, value18).trim();
              break;
            }
            value16 = value18 + value15.length;
          }
          if (unicodeCharacterCount(text) > maxExampleLength) {
            return callback();
          }
        }
        let values = new Set(options.map((input) => input[0]));
        if (
          !items2.every(
            ([input]) =>
              values.has(input) ||
              extra.has(input) ||
              /^(?:aria-|data-|on[A-Z])/.test(input),
          )
        ) {
          return callback();
        }
        let value9 = qualifiedName(items) + value6,
          value10 = items2
            .map(
              ([input, input2]): string =>
                " " + input + (input2 === undefined ? "" : "=" + input2),
            )
            .join(""),
          value11 = ((input: string) =>
            input.replace(
              /<(\/?)([A-Z][\w$]*)(?=[\s/>.])/g,
              (input2: string, options2: string, context2: string) =>
                context2 === items ||
                documentedComponentNames.has(context2) ||
                (exportsByName.get(context2) === context2 &&
                  isComponentDeclaration(context2))
                  ? "<" + options2 + qualifiedName(context2)
                  : input2,
            ))(
            flag
              ? "<" + items + value6 + value10 + " />"
              : "<" +
                  items +
                  value6 +
                  value10 +
                  ">" +
                  text +
                  "</" +
                  items +
                  value6 +
                  ">",
          ),
          callback2 = (input: string) =>
            /^(?:-?\d[\d.]*|true|false|null|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|'[^']*')$/.test(
              input,
            )
              ? input
              : "…",
          value12 = items2
            .map(
              ([input, input2]): string =>
                " " +
                kebabPropName(input) +
                "=" +
                (input2 === undefined
                  ? '"{{yes}}"'
                  : input2.startsWith("{")
                    ? '"{{' +
                      callback2(input2.slice(1, -1).trim().replace(/"/g, "'")) +
                      '}}"'
                    : input2),
            )
            .join(""),
          value13 = /<\/?[A-Za-z]/.test(text) ? "…" : text;
        return [
          value11,
          '<x-import component-from-global-scope="' +
            value9 +
            '"' +
            value12 +
            ">" +
            value13 +
            "</x-import>",
        ];
      },
      propsTable = (
        items: readonly M.DocPropRow[],
        options = "_No props beyond standard HTML attributes._",
      ) => {
        if (items.length === 0) {
          return options;
        }
        let items2 = ["| prop | type | note |", "| --- | --- | --- |"];
        for (let [value, value2, value3, value4] of items) {
          let value5 = markdownTableCell(describeExternalType(value3)),
            text: string =
              '(?:"[^"]*"|`[^`]*`|-?\\d[\\d.]*|true|false|null|undefined|string|number|boolean)',
            value6 = new RegExp(
              "^" + text + "(?:\\s*\\\\\\|\\s*" + text + ")*$",
            ).test(value5);
          if (unicodeCharacterCount(value5) > (value6 ? 600 : 110)) {
            value5 =
              truncateUnicodeText(value5, value6 ? 597 : 107).replace(
                /\\$/,
                "",
              ) + "…";
          }
          let value7 = markdownTableCell(value4);
          if (unicodeCharacterCount(value7) > 160) {
            value7 = truncateUnicodeText(value7, 157) + "…";
          }
          items2.push(
            "| " +
              markdownCodeSpan(value) +
              (value2 ? " *" : "") +
              " | " +
              markdownCodeSpan(value5) +
              " | " +
              value7 +
              " |",
          );
        }
        return items2.join(`
`);
      },
      firstSentence = (input: string) => {
        let value = /^([^\n]+?[.!?])(\s|$)/.exec(input);
        return truncateUnicodeText(value ? value[1] : input, 160).trim();
      },
      iconNames = typeAliases.has("IconName")
        ? [...typeAliases.get("IconName")!.matchAll(/"([^"]+)"/g)].map(
            (input) => input[1],
          )
        : [],
      iconsCard: M.ApiDocumentationCard | null = null;
    if (iconNames.length > 0) {
      let value = qualifiedName(facts.icon ?? "Icon"),
        items = [
          "# Icons",
          "",
          String(iconNames.length) +
            " named glyphs" +
            (facts.css
              ? " from the icon font in " +
                markdownCodeSpan("components/bundle.css")
              : "") +
            ". Never draw an SVG icon the system has.",
          "",
          "## Use",
          "",
          MARKDOWN_CODE_FENCE + "jsx",
          "<" + value + ' name="' + iconNames[0] + '" />',
          MARKDOWN_CODE_FENCE,
          "",
          MARKDOWN_CODE_FENCE + "html",
          '<x-import component-from-global-scope="' +
            value +
            '" name="' +
            iconNames[0] +
            '"></x-import>',
          MARKDOWN_CODE_FENCE,
          "",
          "## Names",
          "",
          [...iconNames].sort().map(markdownCodeSpan).join(", "),
          "",
        ];
      iconsCard = makeApiDocumentationCard(
        "icons",
        "Icons",
        String(iconNames.length) +
          " icon names for " +
          markdownCodeSpan(facts.icon ?? "Icon") +
          " and every " +
          markdownCodeSpan("icon=") +
          " prop.",
        runtime.GENERATED_API_DIRECTORY + "icons.md",
        items,
      );
    }
    let componentCards: M.ApiDocumentationCard[] = [];
    for (let value of groupDocumentedComponents(facts).flat()) {
      let name = value.name;
      remainingWork = maxWork;
      let value2 = wrappedComponentType(name),
        value3 =
          componentPropsType(name) ??
          (value2 !== null ? componentPropsType(value2) : null),
        value4 =
          declarationDoc(name) ||
          declarationDoc(value3 ?? "") ||
          (value2 !== null ? declarationDoc(value2) : ""),
        [value5, value6, value7] =
          value3 !== null
            ? resolveNamedProps(value3)
            : [inlineComponentProps(value2 ?? name), [], null],
        value8 = refineEnumProps(value3 ?? "", value5),
        { parts: value9, callable: value10 } = value.page
          ? {
              parts: [],
              callable: false,
            }
          : componentParts(name),
        value11 = value.page
          ? []
          : relatedComponents(name).filter(
              (input): boolean =>
                !value9.some((input2): boolean => input === name + input2[0]),
            ),
        value12 = value.summary || firstSentence(value4) || name + ".",
        values = new Set<string>();
      for (let value17 of value6) {
        let value18 =
          /^(\w*Omit|Pick)<\s*([A-Za-z_$][\w$]*)[^,]*,([\s\S]*)>$/.exec(
            value17,
          );
        if (value18 === null) {
          continue;
        }
        let value19 = [...value18[3].matchAll(/"([^"]+)"/g)].map(
          (input) => input[1],
        );
        if (value18[1] === "Pick") {
          for (let value20 of value19) {
            values.add(value20);
          }
        } else {
          for (let value20 of resolveNamedProps(value18[2])[0]) {
            if (!value19.includes(value20[0])) {
              values.add(value20[0]);
            }
          }
        }
      }
      let [value13, value14] = componentExamples(
          name,
          value8,
          value4,
          !value10 && value9.some((input): boolean => input[0] === "Root")
            ? ".Root"
            : "",
          values,
        ),
        items = [...value9.map((input) => input[0]), ...value11],
        items2 = [
          "# " + name,
          "",
          value12,
          "",
          (value.page
            ? "showcase page"
            : markdownCodeSpan(qualifiedName(name))) +
            (value.group !== "" ? " · " + value.group : "") +
            (value9.length > 0
              ? " · parts: " + value9.map((input) => input[0]).join(", ")
              : "") +
            (value11.length > 0 ? " · with: " + value11.join(", ") : ""),
          "",
        ];
      if (value.page) {
        items2.push(
          "## Use",
          "",
          "A showcase page of the source project, not a component the bundle exports: there is nothing to mount.",
          "",
        );
      } else if (facts.bundle) {
        items2.push(
          "## Use",
          "",
          MARKDOWN_CODE_FENCE + "jsx",
          value13,
          MARKDOWN_CODE_FENCE,
          "",
          MARKDOWN_CODE_FENCE + "html",
          value14,
          MARKDOWN_CODE_FENCE,
          "",
        );
      } else {
        items2.push(
          "## Use",
          "",
          "Documentation only: this system ships no " +
            markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleJs) +
            " to mount it from" +
            (value.readme
              ? " — build to the long README’s guidelines."
              : ". Build to this card."),
          "",
        );
      }
      if (value4 !== "" && unicodeCharacterCount(value4) > 40) {
        items2.push(
          "## Notes",
          "",
          truncateUnicodeText(sanitizeMarkdownLine(value4), 900),
          "",
        );
      }
      let callback = (input: string) => {
          let value17 = markdownTableCell(input);
          if (unicodeCharacterCount(value17) > 600) {
            return truncateUnicodeText(value17, 597) + "…";
          } else {
            return value17;
          }
        },
        value15: string = value.readme ? "; see the long README" : "",
        callback2 = (
          input: string | null,
          options: string | null,
          items4: readonly string[],
        ): string =>
          options === wideTypeSentinel
            ? "_Props are " +
              markdownCodeSpan(input ?? "a union") +
              ", too wide to tabulate here" +
              value15 +
              " (types: " +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts) +
              ")._"
            : input !== null && firstDeclaration(input) === undefined
              ? "_Props are " +
                markdownCodeSpan(
                  markdownTableCell(describeExternalType(input)),
                ) +
                ", from the library this wraps — not spelled out in " +
                markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts) +
                value15 +
                "._"
              : options !== null
                ? "_Props are " +
                  markdownCodeSpan(callback(describeExternalType(options))) +
                  ", inherited from the library this wraps — not spelled out in " +
                  markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts) +
                  value15 +
                  "._"
                : items4.length > 0
                  ? "_No props of its own; it takes what " +
                    callback(
                      describeExternalType(uniqueValues(items4).join(", ")),
                    ) +
                    " takes._"
                  : "_No props of its own._",
        value16 =
          declarationText === null
            ? "_This system ships no " +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts) +
              value15 +
              "._"
            : value3 === null && value6.length === 0
              ? value8.length > 0
                ? undefined
                : "_No " +
                  markdownCodeSpan(name + "Props") +
                  " in " +
                  markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts) +
                  value15 +
                  "._"
              : callback2(value3, value7, value6);
      if (!(value.page && value3 === null && value8.length === 0)) {
        items2.push(
          "## Props" +
            (value3 !== null ? " (" + describeExternalType(value3) + ")" : ""),
          "",
          propsTable(value8, value16),
          "",
        );
      }
      if (value6.length > 0 && value8.length > 0) {
        items2.push(
          "_Also accepts: " +
            callback(describeExternalType(uniqueValues(value6).join(", "))) +
            "._",
          "",
        );
      }
      for (let [value17, value18, value19] of value9) {
        if (value18 !== null && value18 === value3) {
          continue;
        }
        let [value20, value21, value22] =
          value18 !== null
            ? resolveNamedProps(value18)
            : [value19 ?? [], [], null];
        if (value18 === null && value19 === null) {
          items2.push(
            "### " + name + "." + value17,
            "",
            "_Its props type is not named in " +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts) +
              value15 +
              "._",
            "",
          );
          continue;
        }
        items2.push(
          "### " + name + "." + value17,
          "",
          propsTable(
            refineEnumProps(value18 ?? "", value20),
            callback2(value18, value22, value21),
          ),
          "",
        );
        if (value21.length > 0 && value20.length > 0) {
          items2.push(
            "_Also accepts: " +
              callback(describeExternalType(uniqueValues(value21).join(", "))) +
              "._",
            "",
          );
        }
      }
      for (let value17 of value11) {
        let value18 = componentPropsType(value17),
          value19 =
            value18 !== null
              ? refineEnumProps(value18, resolveNamedProps(value18)[0])
              : inlineComponentProps(value17);
        if (value19.length > 0) {
          items2.push(
            "### " + value17,
            "",
            ...(declarationDoc(value17) !== ""
              ? [firstSentence(declarationDoc(value17)), ""]
              : []),
            propsTable(value19),
            "",
          );
        }
      }
      let items3: string[] = [];
      for (let value17 of value8) {
        for (let value18 of value17[2].matchAll(
          /\b(?<!typeof )([A-Z][A-Za-z]+)\b(?!\s*\[\s*["'])/g,
        )) {
          let value19 = value18[1];
          if (
            items3.includes(value19) ||
            items.includes(value19) ||
            value19.endsWith("Props") ||
            value19.startsWith("React") ||
            value19.startsWith("HTML") ||
            (facts.ns !== null && value19.startsWith(facts.ns)) ||
            ["ReactNode", "ReactElement", "IconName", "Date"].includes(value19)
          ) {
            continue;
          }
          let value20 = firstDeclaration(value19)?.[0];
          if (value20 === "interface" || value20 === "type") {
            items3.push(value19);
          }
        }
      }
      let index: number = 0;
      for (let value17 of items3) {
        if (index >= 6) {
          break;
        }
        let [value18] = resolveNamedProps(value17, new Set(), keepAllProps);
        if (value18.length === 0) {
          continue;
        }
        index++;
        items2.push(
          "### " + value17,
          "",
          ...(declarationDoc(value17) !== ""
            ? [firstSentence(declarationDoc(value17)), ""]
            : []),
          propsTable(value18),
          "",
        );
      }
      if (value.readme) {
        items2.push(
          "## More",
          "",
          "Long-form usage: " +
            markdownCodeSpan(
              runtime.DESIGN_SYSTEM_PATHS.componentsDir + name + "/README.md",
            ) +
            ".",
          "",
        );
      }
      if (
        (0, runtime.isPublishableFilePathModelFileTable)(
          runtime.GENERATED_API_DIRECTORY + "components/" + name + ".md",
        )
      ) {
        componentCards.push(
          makeApiDocumentationCard(
            "component",
            name,
            value12,
            runtime.GENERATED_API_DIRECTORY + "components/" + name + ".md",
            items2,
          ),
        );
      }
    }
    let result = {
      iconNames: iconNames,
      icons: iconsCard,
      components: componentCards,
    };
    cachedComponentApiCards = {
      dts: declarationText,
      key: cacheKey,
      out: result,
    };
    return result;
  }
  function groupDocumentedComponents(
    facts: M.ManifestDocumentationFacts,
  ): M.DocumentationComponent[][] {
    let groups = new Map<string, M.DocumentationComponent[]>();
    for (let value of facts.comps) {
      groups.set(value.group, [...(groups.get(value.group) ?? []), value]);
    }
    return [...groups.values()];
  }
  function fontFamilySlug(family: string): string {
    let slug = family
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug === "") {
      return "font";
    } else {
      return slug;
    }
  }
  function chooseRegularFontFace(
    fonts: readonly Core.FontFace[],
  ): Core.FontFace | undefined {
    let score = (input: Core.FontFace) => {
      let [value, value2] = input.weight.split(" ").map(Number),
        value3 = value2 ?? value;
      return (
        (input.style === "normal" ? 0 : 1e4) +
        (value <= 400 && 400 <= value3
          ? 0
          : Math.min(Math.abs(value - 400), Math.abs(value3 - 400)))
      );
    };
    return [...fonts].sort(
      (input, options) => score(input) - score(options),
    )[0];
  }
  function generateConsumptionDocumentation(
    options: M.ConsumptionDocumentationOptions,
  ): Core.ConsumptionDocumentation {
    let { tokens: tokens, manifest: manifest } = options,
      declarationText =
        options.dts === null ? null : normalizeTextNewlines(options.dts),
      sourceReadme = normalizeTextNewlines(options.readme),
      assetReadmes = Object.fromEntries(
        Object.entries<string>(options.assetReadmes)
          .filter((input): boolean => typeof input[1] === "string")
          .map(([input, input2]) => [input, normalizeTextNewlines(input2)]),
      ),
      facts = documentationManifestFacts(manifest),
      namespace = facts.ns ?? "window",
      qualifiedName = (input: string): string =>
        (facts.ns !== null ? facts.ns + "." : "") + input,
      listedPaths = new Set(
        Array.isArray(manifest.files)
          ? (manifest.files as unknown[]).filter(
              (input: unknown): input is string => typeof input === "string",
            )
          : [],
      ),
      storageFiles: Readonly<
        Record<string, M.DocStoredFile | null | undefined>
      > =
        typeof manifest.storage === "object" &&
        manifest.storage !== null &&
        typeof manifest.storage.files === "object" &&
        manifest.storage.files !== null
          ? (manifest.storage.files as Readonly<
              Record<string, M.DocStoredFile | null | undefined>
            >)
          : {},
      fontRows = (() => {
        let value = tokens?.type.fonts ?? [];
        if (value.length === 0) {
          return [];
        }
        let families = tokens!.type.families,
          callback = (input: string) => {
            let value2 = storageFiles[input];
            if (
              typeof value2 === "object" &&
              value2 !== null &&
              value2.store === "blob" &&
              typeof value2.id === "string" &&
              runtime.BLOB_ID_PATTERN.test(value2.id)
            ) {
              return markdownCodeSpan("read " + value2.id);
            }
            if (!listedPaths.has(input) && facts.listed) {
              return "inline in the page only";
            }
            let value3 = options.root ?? "";
            if (value3 === "") {
              return markdownCodeSpan("read " + input);
            } else {
              return (
                markdownCodeSpan("read") +
                " the file with " +
                markdownCodeSpan(value3) +
                " in front"
              );
            }
          },
          callback2 = (input: string) =>
            Object.keys(facts.tokensCss ? families : {}).find((input2) =>
              families[input2]
                .split(",")
                .map((input3) =>
                  input3
                    .trim()
                    .replace(/^["']|["']$/g, "")
                    .toLowerCase(),
                )
                .includes(input.toLowerCase()),
            );
        return uniqueValues(value.map((input) => input.family)).map((input) => {
          let value2 = chooseRegularFontFace(
              value.filter((input2): boolean => input2.family === input),
            )!,
            value3 = callback2(input);
          return [
            markdownTableCell(input),
            markdownCodeSpan(value2.file) +
              " (weight " +
              markdownTableCell(value2.weight) +
              (value2.style !== "normal" ? ", " + value2.style : "") +
              ")",
            callback(value2.file),
            value3 !== undefined
              ? markdownCodeSpan(
                  "var(--font-" +
                    (0, runtime.escapeTokenCssIdentifier)(value3) +
                    ")",
                )
              : "",
            markdownCodeSpan(fontFamilySlug(input)),
          ];
        });
      })(),
      cleanReadme = sourceReadme.replace(/\uFFFD/g, "").trimEnd(),
      migrationGuide = inspectStandaloneMigrationGuide(cleanReadme),
      fontPaths = uniqueValues(
        (tokens?.type.fonts ?? []).map((input) => input.file),
      ),
      canInstallFontsByPath =
        !migrationGuide.both &&
        facts.listed &&
        facts.tokensCss &&
        fontPaths.length > 0 &&
        fontPaths.every(
          (input) =>
            listedPaths.has(input) &&
            isInstallableFontPath(input) &&
            storageFiles[input]?.store !== "blob",
        ),
      fontGuide = fontConsumptionGuide(
        canInstallFontsByPath,
        !migrationGuide.both,
        fontPaths,
      ),
      fontTable = () => [
        "| family | file | fetch | CSS | Slides " +
          markdownCodeSpan("faces") +
          " key |",
        "| --- | --- | --- | --- | --- |",
        ...fontRows.map((input): string => "| " + input.join(" | ") + " |"),
      ],
      cards: M.ApiDocumentationCard[] = [],
      cardPaths = new Set<string>(),
      addCard = (
        input: string,
        options2: string,
        context: string,
        value: string,
        extra: readonly string[],
      ): void => {
        if (cardPaths.has(value.toLowerCase())) {
          return;
        }
        cardPaths.add(value.toLowerCase());
        cards.push(
          makeApiDocumentationCard(input, options2, context, value, extra),
        );
      };
    if (tokens !== null && tokens.color.tokens.length > 0) {
      let value = tokens.color.themes.map((input) => input.id),
        value2 = (0, runtime.commonTokenNamePrefix)(
          tokens.color.tokens.map((input) => input.name),
        ),
        callback = (input: Core.ColorToken) =>
          value2 !== "" && input.name.startsWith(value2)
            ? input.name.slice(value2.length)
            : input.name,
        callback2 = (input: Core.ColorToken) =>
          value
            .map((input2) =>
              markdownTableCell(
                (0, runtime.resolveColorTokenValue)(input, input2, tokens) ??
                  "",
              ),
            )
            .join(" | "),
        value3: string = facts.css
          ? "tokens.css or components/bundle.css"
          : "tokens.css",
        values = new Set<string>();
      for (let value4 of COLOR_DOCUMENTATION_GROUPS) {
        let value5 = tokens.color.tokens.filter(
          (input) =>
            !values.has(input.name) && value4.test.test(callback(input)),
        );
        for (let value6 of value5) {
          values.add(value6.name);
        }
        if (value5.length === 0) {
          continue;
        }
        let items = [
          "# Color · " + value4.title,
          "",
          "## Use",
          "",
          MARKDOWN_CODE_FENCE + "css",
          "/* any surface that loads " + value3 + " */",
          "color: var(--" +
            (0, runtime.escapeTokenCssIdentifier)(value5[0].name) +
            ");",
          "/* a surface with no stylesheet (a slide): the " +
            (value[0] ?? "first") +
            " value" +
            (value.length > 1 ? ", or another theme’s in that mode" : "") +
            " */",
          MARKDOWN_CODE_FENCE,
          "",
          "## Tokens (" + String(value5.length) + ")",
          "",
          "| token | " + value.join(" | ") + " | usage |",
          "| --- |" + " --- |".repeat(value.length) + " --- |",
        ];
        if (value4.key === "palette") {
          let entries = new Map<string, [number, string][]>();
          for (let value6 of value5) {
            let value7 = PALETTE_RAMP_TOKEN_PATTERN.exec(callback(value6));
            if (value7 === null) {
              items.push(
                "| " +
                  markdownCodeSpan(value6.name) +
                  " | " +
                  callback2(value6) +
                  " | " +
                  markdownTableCell(value6.usage) +
                  " |",
              );
              continue;
            }
            let value8 = value7[1];
            if (!entries.has(value8)) {
              entries.set(value8, []);
            }
            entries
              .get(value8)!
              .push([
                parseInt(value7[2], 10),
                (0, runtime.resolveColorTokenValue)(
                  value6,
                  value[0] ?? "",
                  tokens,
                ) ?? "",
              ]);
          }
          if (entries.size > 0) {
            items.push(
              "",
              "| ramp | steps | first → last (" + (value[0] ?? "") + ") |",
              "| --- | --- | --- |",
            );
            for (let [value6, value7] of entries) {
              value7.sort((input, options2) => input[0] - options2[0]);
              items.push(
                "| " +
                  markdownCodeSpan(value2 + value6 + "-*") +
                  " | " +
                  value7.map((input): string => String(input[0])).join(", ") +
                  " | " +
                  markdownTableCell(value7[0][1]) +
                  " → " +
                  markdownTableCell(value7[value7.length - 1][1]) +
                  " |",
              );
            }
          }
        } else {
          let value6 = value5.filter((input) =>
            COLOR_INTERACTION_SUFFIX_PATTERN.test(input.name),
          );
          for (let value7 of value5) {
            if (!COLOR_INTERACTION_SUFFIX_PATTERN.test(value7.name)) {
              items.push(
                "| " +
                  markdownCodeSpan(value7.name) +
                  " | " +
                  callback2(value7) +
                  " | " +
                  markdownTableCell(value7.usage) +
                  " |",
              );
            }
          }
          if (value6.length > 0) {
            items.push(
              "",
              "**Interaction states** (same roles, suffixed):",
              "",
              "| token | " + value.join(" | ") + " |",
              "| --- |" + " --- |".repeat(value.length),
            );
            for (let value7 of value6) {
              items.push(
                "| " +
                  markdownCodeSpan(value7.name) +
                  " | " +
                  callback2(value7) +
                  " |",
              );
            }
          }
        }
        items.push("");
        addCard(
          "tokens",
          "color/" + value4.key,
          value4.title +
            " — " +
            String(value5.length) +
            (value5.length === 1 ? " token." : " tokens."),
          runtime.GENERATED_API_DIRECTORY + "tokens/" + value4.key + ".md",
          items,
        );
      }
    }
    if (
      tokens !== null &&
      (tokens.type.groups.length > 0 ||
        tokens.type.fonts.length > 0 ||
        Object.keys(tokens.type.families).length > 0)
    ) {
      let type = tokens.type,
        value = type.groups.flatMap((input) =>
          input.styles.map(
            (input2): string =>
              "| " +
              markdownCodeSpan(input2.name) +
              " | " +
              markdownCodeSpan(
                "." + (0, runtime.escapeTokenCssIdentifier)(input2.name),
              ) +
              ", " +
              markdownCodeSpan(
                "--text-" + (0, runtime.escapeTokenCssIdentifier)(input2.name),
              ) +
              " | " +
              markdownTableCell(input2.fontSize) +
              " / " +
              markdownTableCell(input2.lineHeight) +
              " | " +
              markdownTableCell(input2.fontWeight) +
              " | " +
              markdownCodeSpan(
                markdownTableCell(input2.family || input.family),
              ) +
              " | " +
              markdownTableCell(input2.usage) +
              " |",
          ),
        ),
        value2 = type.groups[0]?.styles[0]?.name ?? "body",
        value3 = Object.keys(type.families)[0] ?? "sans",
        items = [
          "# Type",
          "",
          "Use the named styles; no literal px." +
            (type.groups.some((input): boolean => input.note !== "")
              ? " " +
                type.groups
                  .map((input) => sanitizeMarkdownLine(input.note).trim())
                  .filter((input): boolean => input !== "")
                  .join(" ")
              : ""),
          "",
          "## Use",
          "",
          MARKDOWN_CODE_FENCE + "css",
          "font: var(--text-" +
            (0, runtime.escapeTokenCssIdentifier)(value2) +
            ");            /* with tokens.css */",
          "font-family: var(--font-" +
            (0, runtime.escapeTokenCssIdentifier)(value3) +
            ");   /* the family alone */",
          MARKDOWN_CODE_FENCE,
          "",
        ];
      if (value.length > 0) {
        items.push(
          "## Styles",
          "",
          "| style | CSS | size / line | weight | family | usage |",
          "| --- | --- | --- | --- | --- | --- |",
          ...value,
          "",
        );
      }
      let value4 = Object.entries<string>(type.families);
      if (value4.length > 0) {
        items.push(
          "## Families",
          "",
          "| family | CSS variable | stack |",
          "| --- | --- | --- |",
          ...value4.map(
            ([input, input2]): string =>
              "| " +
              markdownCodeSpan(input) +
              " | " +
              markdownCodeSpan("--font-" + input) +
              " | " +
              markdownCodeSpan(markdownTableCell(input2)) +
              " |",
          ),
          "",
        );
      }
      if (fontRows.length > 0) {
        items.push(
          "## Font files",
          "",
          ...fontGuide,
          "",
          ...(facts.tokensCss
            ? [
                markdownCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH) +
                  " carries the " +
                  markdownCodeSpan("@font-face") +
                  " rules for a page that links it and names each family by the CSS variable below.",
                "",
              ]
            : []),
          ...fontTable(),
          "",
          ...(type.fonts.length > fontRows.length
            ? [
                "Every face: " +
                  type.fonts
                    .map(
                      (input): string =>
                        markdownCodeSpan(input.file) +
                        " (" +
                        markdownTableCell(input.family) +
                        ", " +
                        markdownTableCell(input.weight) +
                        (input.style !== "normal" ? ", " + input.style : "") +
                        ")",
                    )
                    .join(", ") +
                  ".",
                "",
              ]
            : []),
        );
      }
      addCard(
        "tokens",
        "type",
        "Type styles, families, font files.",
        runtime.GENERATED_API_DIRECTORY + "tokens/type.md",
        items,
      );
    }
    if (tokens !== null) {
      let value = tokens.color.themes.map((input) => input.id),
        callback = (
          input: string,
          options2: string,
          context: string,
          items: readonly (Core.ScalarToken | Core.ShadowToken)[],
        ): void => {
          if (items.length === 0) {
            return;
          }
          let callback2 = (input2: string | Record<string, string>) => {
              if (typeof input2 === "string") {
                return markdownTableCell(input2);
              }
              let value2 = input2[value[0] ?? ""] ?? "";
              return (
                markdownTableCell(value2) +
                value
                  .slice(1)
                  .map((input3): string =>
                    input2[input3] !== undefined && input2[input3] !== value2
                      ? " · " +
                        input3 +
                        ": " +
                        markdownTableCell(input2[input3])
                      : "",
                  )
                  .join("")
              );
            },
            name = items[0].name,
            items2 = [
              "# " + options2,
              "",
              ...(context.trim() !== ""
                ? [sanitizeMarkdownLine(context).trim(), ""]
                : []),
              "## Use",
              "",
              MARKDOWN_CODE_FENCE + "css",
              input === "spacing"
                ? "padding: var(--" +
                  (0, runtime.escapeTokenCssIdentifier)(name) +
                  ");"
                : "/* var(--" +
                  (0, runtime.escapeTokenCssIdentifier)(name) +
                  ") */",
              MARKDOWN_CODE_FENCE,
              "",
              "## Tokens (" + String(items.length) + ")",
              "",
              "| token | value | usage |",
              "| --- | --- | --- |",
              ...items.map(
                (input2): string =>
                  "| " +
                  markdownCodeSpan(input2.name) +
                  " | " +
                  callback2(input2.value) +
                  " | " +
                  markdownTableCell(input2.usage) +
                  " |",
              ),
              "",
            ];
          addCard(
            "tokens",
            input,
            options2 +
              " — " +
              String(items.length) +
              (items.length === 1 ? " token." : " tokens."),
            runtime.GENERATED_API_DIRECTORY + "tokens/" + input + ".md",
            items2,
          );
        };
      callback(
        "spacing",
        "Spacing",
        tokens.spacing.note,
        tokens.spacing.tokens,
      );
      callback("radius", "Radius", tokens.radius.note, tokens.radius.tokens);
      callback("shadow", "Shadow", tokens.shadow.note, tokens.shadow.tokens);
      for (let value2 of tokens.extra) {
        callback(
          tokenFamilySlug(value2.key),
          humanizeFamilyName(value2.key),
          value2.note,
          value2.tokens,
        );
      }
    }
    let tokenCardMode = options.tokenCards ?? DEFAULT_TOKEN_CARD_MODE,
      inlineTokensSection = "";
    if (tokenCardMode !== "per-group" && cards.length > 0) {
      let value = cards.splice(0, cards.length),
        flag: boolean = false,
        callback = (input: string) =>
          input
            .split(
              `
`,
            )
            .map((input2) => {
              if (input2.startsWith(MARKDOWN_CODE_FENCE)) {
                flag = !flag;
              }
              if (!flag && input2.startsWith("#")) {
                return "#" + input2;
              } else {
                return input2;
              }
            }).join(`
`),
        items = [
          "# Tokens",
          "",
          "Every token of the system, a section per group: " +
            value.map((input) => input.purpose.replace(/\.$/, "")).join("; ") +
            ".",
          "",
          ...value.map((input) => callback(input.text)),
        ];
      if (tokenCardMode === "single") {
        cards.push(
          makeApiDocumentationCard(
            "tokens",
            "tokens",
            "Every token: " +
              value
                .map((input) => input.name.replace(/^color\//, ""))
                .join(", ") +
              ".",
            runtime.GENERATED_API_DIRECTORY + "tokens.md",
            items,
          ),
        );
      } else {
        inlineTokensSection = callback(
          items.join(`
`),
        ).replace(
          /^## Tokens\n/,
          GENERATED_INLINE_TOKENS_HEADING +
            `
`,
        );
      }
    }
    let componentCards = generateComponentApiCards(declarationText, facts);
    if (componentCards.icons !== null) {
      cards.push(componentCards.icons);
    }
    let assetGroups = Array.isArray(manifest.assetGroups)
      ? (
          manifest.assetGroups as (M.RawDocAssetGroup | null | undefined)[]
        ).filter(
          (input): input is M.CheckedDocAssetGroup =>
            typeof input === "object" &&
            input !== null &&
            typeof input.name === "string" &&
            (0, runtime.isPublishableFilePathModelFileTable)(
              runtime.GENERATED_API_DIRECTORY +
                "assets/" +
                assetDocumentationSlug(input.name) +
                ".md",
            ),
        )
      : [];
    for (let value of assetGroups) {
      let value2 = Array.isArray(value.files)
        ? (value.files as (M.RawDocAssetFile | null | undefined)[]).filter(
            (input): input is M.CheckedDocAssetFile =>
              typeof input?.path === "string" &&
              typeof input.id === "string" &&
              runtime.BLOB_ID_PATTERN.test(input.id) &&
              (0, runtime.isValidDesignSystemPath)(input.path),
          )
        : [];
      if (value2.length === 0) {
        continue;
      }
      let value3: string =
          String(value2.length) + (value2.length === 1 ? " file" : " files"),
        value4 = (
          assetReadmes[
            runtime.DESIGN_SYSTEM_PATHS.assetsDir + value.name + "/README.md"
          ] ?? ""
        ).trim(),
        items = [
          "# Assets · " + sanitizeMarkdownLine(value.name),
          "",
          value3 +
            " under " +
            markdownCodeSpan(
              runtime.DESIGN_SYSTEM_PATHS.assetsDir + value.name + "/",
            ) +
            // CucCut: uploads are files in the system's _blobs/ folder, read like any file, and a consumer imports
            // them with its own tool (design_import_asset), not the Artifact tool's read and publish.
            ", held in the system’s upload store: read one as the file " +
            markdownCodeSpan("_blobs/<id>.<ext>") +
            " in this system’s directory, the id below as " +
            markdownCodeSpan("<id>") +
            " (they are not files under that folder — a read by that path fails), then add it to your own work as an asset (" +
            markdownCodeSpan("design_import_asset") +
            ", where your tool lists that); an SVG may also be inlined. Copy assets, never approximate them.",
          "",
        ];
      if (/^icons?$/i.test(value.name) && facts.icon !== null) {
        items.push(
          "These are the glyphs " +
            markdownCodeSpan(qualifiedName(facts.icon)) +
            " and every " +
            markdownCodeSpan("icon=") +
            " prop render — mount the component wherever the bundle runs; the files are for surfaces without it (a deck)." +
            (componentCards.iconNames.length > 0
              ? " Names: " +
                markdownCodeSpan(runtime.GENERATED_API_DIRECTORY + "icons.md") +
                "."
              : ""),
          "",
        );
      }
      items.push(
        "## Use",
        "",
        MARKDOWN_CODE_FENCE + "html",
        '<img src="<the url the asset upload returned for ' +
          sanitizeMarkdownLine(value2[0].path.split("/").at(-1)!) +
          '>" alt="…">',
        MARKDOWN_CODE_FENCE,
        "",
      );
      if (value4 !== "") {
        items.push("## Usage notes", "", value4, "");
      }
      items.push(
        "## Files",
        "",
        "| file | fetch |",
        "| --- | --- |",
        ...value2.map(
          (input): string =>
            "| " +
            markdownCodeSpan(markdownTableCell(input.path)) +
            " | " +
            markdownCodeSpan("read " + markdownTableCell(input.id)) +
            " |",
        ),
        "",
      );
      addCard(
        "assets",
        value.name,
        value3 + ", by asset id.",
        runtime.GENERATED_API_DIRECTORY +
          "assets/" +
          assetDocumentationSlug(value.name) +
          ".md",
        items,
      );
    }
    for (let value of componentCards.components) {
      if (!cardPaths.has(value.path.toLowerCase())) {
        cardPaths.add(value.path.toLowerCase());
        cards.push(value);
      }
    }
    let files = new Map<string, string>(),
      index: Core.ApiDocumentationIndexEntry[] = [];
    for (let value of cards) {
      let value2: string =
        runtime.GENERATED_API_FILE_HEADER +
        `
` +
        value.text;
      files.set(value.path, value2);
      index.push({
        kind: value.kind,
        name: value.name,
        purpose: value.purpose,
        path: value.path,
        size: unicodeCharacterCount(value2),
      });
    }
    let cardsOfKind = (input: string) =>
        index.filter((source): boolean => source.kind === input),
      hasMigrationGuide = migrationGuide.both,
      consumptionLines = [
        GENERATED_CONSUMPTION_HEADING,
        "",
        ...(hasMigrationGuide ? [STANDALONE_CONSUMPTION_GUIDANCE, ""] : []),
      ],
      readPerThing = [];
    if (cardsOfKind("component").length > 0) {
      readPerThing.push(
        "a component’s props, parts and examples: " +
          markdownCodeSpan(
            runtime.GENERATED_API_DIRECTORY + "components/<Comp>.md",
          ),
      );
    }
    if (cardsOfKind("icons").length > 0) {
      readPerThing.push(
        "icon names: " +
          markdownCodeSpan(runtime.GENERATED_API_DIRECTORY + "icons.md"),
      );
    }
    if (inlineTokensSection !== "") {
      readPerThing.push("token values: the Tokens section below");
    } else if (cardsOfKind("tokens").length > 0) {
      readPerThing.push(
        "token values: " +
          markdownCodeSpan(
            cardsOfKind("tokens").length === 1 &&
              cardsOfKind("tokens")[0].path ===
                runtime.GENERATED_API_DIRECTORY + "tokens.md"
              ? runtime.GENERATED_API_DIRECTORY + "tokens.md"
              : runtime.GENERATED_API_DIRECTORY + "tokens/<group>.md",
          ),
      );
    }
    if (cardsOfKind("assets").length > 0) {
      readPerThing.push(
        "stored assets and their paths: " +
          markdownCodeSpan(
            runtime.GENERATED_API_DIRECTORY + "assets/<Group>.md",
          ),
      );
    }
    let componentCount = facts.comps.filter(
        (input): boolean => !input.page,
      ).length,
      librariesDescription = facts.libs
        .map(
          (input): string =>
            (input.file !== null
              ? markdownCodeSpan(input.file)
              : input.name +
                " " +
                input.version +
                " (not packed in this system: bring your own copy)") +
            (input.global !== null
              ? " (" + markdownCodeSpan("window." + input.global) + ")"
              : ""),
        )
        .join(", "),
      rootComponent = facts.comps.find(
        (input) =>
          input.name === (facts.ns ?? "") + "Root" ||
          input.name === "Root" ||
          input.name === (facts.ns ?? "") + "Provider",
      ),
      hasListedPath = (input: string) =>
        !facts.listed || listedPaths.has(input),
      hasComponentReadmes = facts.comps.some((input) => input.readme),
      componentReadmeCode = markdownCodeSpan(
        runtime.DESIGN_SYSTEM_PATHS.componentsDir + "<Comp>/README.md",
      ),
      componentGuidance: string =
        ": read each component’s card" +
        (hasComponentReadmes
          ? ", and its README where it has one (" +
            componentReadmeCode +
            "), and build to those guidelines."
          : " and build to it."),
      tokenGuidance: string =
        inlineTokensSection !== "" || cardsOfKind("tokens").length > 0
          ? "the values are " +
            (tokenCardMode === "inline"
              ? "in the Tokens section below"
              : tokenCardMode === "single"
                ? "on " +
                  markdownCodeSpan(
                    runtime.GENERATED_API_DIRECTORY + "tokens.md",
                  )
                : "on the token cards")
          : "";
    if (hasMigrationGuide && facts.comps.length > 0) {
      let value: string =
          String(componentCount) +
          " component" +
          (componentCount === 1 ? "" : "s"),
        value2: string = facts.tokensCss
          ? markdownCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH) +
            " is every token as a CSS variable plus " +
            markdownCodeSpan("@font-face") +
            " for the fonts"
          : "",
        value3: string =
          facts.libs.length > 0 &&
          facts.libs.every(
            (input) => input.name === "react" || input.name === "react-dom",
          )
            ? "; on a Design canvas skip " +
              (facts.libs.length === 1 ? "that file" : "those files") +
              " (the artboard supplies React)"
            : "";
      consumptionLines.push(
        !migrationGuide.script
          ? String(facts.comps.length) +
              " component" +
              (facts.comps.length === 1 ? " is" : "s are") +
              " documented, and the “Design canvas” line above names no script for " +
              (facts.comps.length === 1 ? "it" : "them") +
              componentGuidance +
              (value2 !== "" ? " " + value2 + "." : "")
          : facts.ns === null
            ? "The “Design canvas” line above names the script for this system’s " +
              value +
              ", and no global is recorded for " +
              (componentCount === 1 ? "it" : "them") +
              componentGuidance +
              (value2 !== "" ? " " + value2 + "." : "")
            : markdownCodeSpan("window." + facts.ns) +
              " is the components’ global (" +
              value +
              "); the “Design canvas” line above names the script that defines it" +
              (value2 !== "" ? "; " + value2 : "") +
              "." +
              (librariesDescription !== ""
                ? " That script needs " +
                  librariesDescription +
                  ", loaded before it" +
                  value3 +
                  "."
                : "") +
              (rootComponent !== undefined
                ? " Wrap everything in one " +
                  markdownCodeSpan(qualifiedName(rootComponent.name)) +
                  ": it scopes the tokens and settings the components read."
                : "") +
              " Build any UI by mounting these components; never hand-build a control or draw an icon the system provides.",
        "",
      );
    } else if (facts.bundle) {
      consumptionLines.push(
        markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleJs) +
          " defines " +
          markdownCodeSpan("window." + namespace) +
          " (" +
          String(componentCount) +
          " component" +
          (componentCount === 1 ? "" : "s") +
          ")" +
          (facts.css
            ? "; " +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleCss) +
              " is its stylesheet"
            : "") +
          (facts.tokensCss
            ? "; " +
              markdownCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH) +
              " is every token as a CSS variable plus " +
              markdownCodeSpan("@font-face") +
              " for the fonts"
            : "") +
          "." +
          (options.cssReadsTokens === true && facts.css && facts.tokensCss
            ? " " +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleCss) +
              " reads its variables from " +
              markdownCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH) +
              "."
            : "") +
          (librariesDescription !== ""
            ? " The bundle needs " +
              librariesDescription +
              ", loaded before it."
            : "") +
          " Build any UI by mounting these components; never hand-build a control or draw an icon the system provides.",
        "",
        "- **Standalone page:** inline " +
          [
            ...(facts.tokensCss
              ? [markdownCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH)]
              : []),
            ...(facts.css
              ? [markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleCss)]
              : []),
          ].join(" and ") +
          (facts.tokensCss || facts.css
            ? " in a " + markdownCodeSpan("<style>") + ", then "
            : "") +
          (facts.libs.length > 0
            ? "the library files and " +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleJs) +
              " as classic scripts"
            : markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleJs) +
              " as a classic script") +
          " (a file containing " +
          markdownCodeSpan("</style") +
          ", " +
          markdownCodeSpan("<\/script") +
          " or " +
          markdownCodeSpan("<\!--") +
          " breaks an inline element: write the sequence " +
          markdownCodeSpan("<\\/style") +
          ", " +
          markdownCodeSpan("<\\/script") +
          " or " +
          markdownCodeSpan("\\x3C!--") +
          " in your copy, or load that file by URL)." +
          (rootComponent !== undefined
            ? " Wrap everything in one " +
              markdownCodeSpan(qualifiedName(rootComponent.name)) +
              ": it scopes the tokens and settings the components read."
            : ""),
        "- **Design canvas:** bring " +
          joinEnglishList([
            ...(facts.css
              ? [markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleCss)]
              : []),
            markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleJs),
            ...(facts.dts
              ? [
                  markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts) +
                    " (for the editor’s props panel)",
                ]
              : []),
          ]) +
          " onto the canvas in full, as the canvas type’s design-system components reference says (a server-side copy first where it offers one)" +
          (facts.css ? "; load the stylesheet before the script" : "") +
          (facts.libs.length > 0 &&
          facts.libs.every(
            (input) => input.name === "react" || input.name === "react-dom",
          )
            ? "; skip the library files (the artboard supplies React)"
            : "") +
          "; mount with " +
          markdownCodeSpan(
            '<x-import component-from-global-scope="' +
              qualifiedName("<Comp>") +
              '" …>',
          ) +
          ".",
        "- **Slides deck, or any surface that cannot run the bundle:** " +
          (tokens === null
            ? "this system has no tokens: there is nothing for a deck to take from it."
            : (fontRows.length > 0 ? "tokens and fonts" : "tokens only") +
              (tokenGuidance !== "" ? " — " + tokenGuidance : "") +
              "; the deck takes " +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.tokens) +
              " by file path for its colour pickers" +
              (fontRows.length > 0
                ? ", and fonts as “Fonts” below says."
                : ".")),
        "",
      );
    } else if (facts.comps.length > 0) {
      consumptionLines.push(
        String(facts.comps.length) +
          " component" +
          (facts.comps.length === 1 ? " is" : "s are") +
          " documented without a runnable " +
          markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.bundleJs) +
          componentGuidance +
          (tokens === null
            ? ""
            : " Tokens: " +
              (tokenGuidance !== ""
                ? tokenGuidance + "; a Slides deck or Design canvas also takes "
                : "a Slides deck or Design canvas takes ") +
              markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.tokens) +
              " by file path."),
        "",
      );
    } else if (cardsOfKind("tokens").length > 0) {
      consumptionLines.push(
        "This system ships tokens" +
          (cardsOfKind("assets").length > 0 ? " and assets" : "") +
          ", no components: take colours, type and fonts from the tokens card below for any page, deck or mock-up; a Slides deck or Design canvas also takes " +
          markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.tokens) +
          // CucCut: CucCut's skills, not the platform types' SKILL.md files.
          " by file path (that kind’s skill says how).",
        "",
      );
    } else {
      consumptionLines.push(
        "This system has no readable tokens and no components yet: the text above" +
          (cardsOfKind("assets").length > 0
            ? " and the asset cards below are"
            : " is") +
          " the whole guide.",
        "",
      );
    }
    if (fontRows.length > 0) {
      consumptionLines.push(...fontGuide, "", ...fontTable(), "");
    }
    consumptionLines.push(
      "**Read, per thing:** " +
        (readPerThing.length > 0
          ? readPerThing.join("; ") +
            ". After this README, fetch the cards and fonts you need in ONE message as parallel calls — none depends on another."
          : "this README is the whole guide."),
      "",
    );
    let longReadmes = [
      ...(hasComponentReadmes ? [componentReadmeCode] : []),
      ...(cardsOfKind("assets").some((input) =>
        hasListedPath(
          runtime.DESIGN_SYSTEM_PATHS.assetsDir + input.name + "/README.md",
        ),
      )
        ? [
            markdownCodeSpan(
              runtime.DESIGN_SYSTEM_PATHS.assetsDir + "<Group>/README.md",
            ),
          ]
        : []),
    ];
    consumptionLines.push(
      "**Two rules.** Before you use a thing — a component, a token group, an icon, an asset — read its card from the index below; a value you did not read from a card is a guess. " +
        joinEnglishList([
          ...(tokens !== null
            ? [markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.tokens)]
            : []),
          markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.manifest),
          ...(facts.dts
            ? [markdownCodeSpan(runtime.DESIGN_SYSTEM_PATHS.indexDts)]
            : []),
          markdownCodeSpan("design-system.json"),
        ]) +
        " are sources for tools: hand them over. " +
        (longReadmes.length > 0
          ? joinEnglishList(longReadmes) +
            (longReadmes.length === 1 ? " is" : " are") +
            " the long-form second read a card links to; "
          : "") +
        // CucCut: the authoring guidance is CucCut's design-system skill; no SKILL.md or artifact-type/ sits beside the files.
        (longReadmes.length > 0 ? "the " : "The ") +
        markdownCodeSpan("design-system") +
        " skill is authoring guidance, not needed to consume the system.",
      "",
    );
    let indexLines = [GENERATED_INDEX_HEADING, ""],
      indexLine = (input: Core.ApiDocumentationIndexEntry): string =>
        "- " +
        markdownCodeSpan(input.path) +
        " — " +
        input.purpose +
        " (" +
        formatCardCharacterCount(input.size) +
        ")";
    if (cardsOfKind("tokens").length > 0) {
      indexLines.push(
        "**Tokens**",
        "",
        ...cardsOfKind("tokens").map(indexLine),
        "",
      );
    }
    if (cardsOfKind("icons").length + cardsOfKind("assets").length > 0) {
      indexLines.push(
        "**Icons and assets**",
        "",
        ...[...cardsOfKind("icons"), ...cardsOfKind("assets")].map(indexLine),
        "",
      );
    }
    if (facts.comps.length > 0) {
      let length = facts.comps.filter((input) => input.page).length;
      indexLines.push(
        "**Components** (" +
          markdownCodeSpan(
            runtime.GENERATED_API_DIRECTORY + "components/<Comp>.md",
          ) +
          ", " +
          String(facts.comps.length) +
          (length > 0
            ? "; " + String(length) + " of them showcase pages"
            : "") +
          ")",
        "",
      );
      for (let value of groupDocumentedComponents(facts)) {
        indexLines.push(
          "- " +
            (value[0].group !== "" ? "**" + value[0].group + "**: " : "") +
            value
              .map(
                (input): string =>
                  markdownCodeSpan(input.name) +
                  (input.page ? " (showcase page)" : "") +
                  " — " +
                  markdownTableCell(
                    index.find(
                      (source) =>
                        source.kind === "component" &&
                        source.name === input.name,
                    )?.purpose ??
                      (input.summary || input.name),
                  ).replace(/\.+$/, ""),
              )
              .join(" · "),
        );
      }
      indexLines.push("");
    }
    if (index.length === 0) {
      indexLines.push(
        inlineTokensSection !== ""
          ? "No cards: the tokens above are this system so far."
          : "No cards: this system has no tokens, components or stored assets yet.",
        "",
      );
    }
    let generatedReadme = (
      consumptionLines.join(`
`) +
      `
` +
      (inlineTokensSection !== ""
        ? inlineTokensSection +
          `
`
        : "") +
      indexLines.join(`
`)
    ).replace(/\uFFFD/g, "");
    return {
      files: files,
      readme:
        (cleanReadme === "" ? "" : cleanReadme + GENERATED_README_SEPARATOR) +
        generatedReadme,
      index: index,
    };
  }
  function findLegacyReadmeTail(readme: string): number {
    let seen: number = 0;
    for (let value of readme.matchAll(LEGACY_README_SECTION_PATTERN)) {
      if (++seen > 64) {
        break;
      }
      let value2 = readme.indexOf(LEGACY_MARKDOWN_FENCE + "json", value.index);
      if (
        value2 === -1 ||
        value2 - value.index > 600 ||
        !LEGACY_MANIFEST_FENCE_PATTERN.test(readme.slice(value2, value2 + 64))
      ) {
        continue;
      }
      let value3 = readme.indexOf(
        `
` + LEGACY_MARKDOWN_FENCE,
        value2 + 8,
      );
      if (value3 === -1) {
        continue;
      }
      let value4 = readme.slice(value3 + 1 + LEGACY_MARKDOWN_FENCE.length);
      if (
        value4.trim() === "" ||
        LEGACY_GENERATED_SECTION_PATTERN.test(value4)
      ) {
        return value.index;
      }
    }
    return -1;
  }
  function generatedReadmeTailOffset(readme: string): number {
    let offsets = [
      GENERATED_README_START_PATTERN.exec(readme)?.index ?? -1,
      findLegacyReadmeTail(readme),
    ].filter((input): boolean => input !== -1);
    if (offsets.length === 0) {
      return -1;
    } else {
      return Math.min(...offsets);
    }
  }
  function stripGeneratedReadmeTail(readme: string): string {
    let tailOffset = generatedReadmeTailOffset(readme);
    if (tailOffset === -1) {
      return readme;
    } else {
      return readme.slice(0, tailOffset);
    }
  }
  function parseJsonOrNull(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  function stripCssComments(css: string): string {
    let parts: string[] = [];
    for (let index = 0; ; ) {
      let value = css.indexOf("/*", index);
      parts.push(css.slice(index, value === -1 ? undefined : value));
      let value2 = value === -1 ? -1 : css.indexOf("*/", value + 2);
      if (value2 === -1) {
        return parts.join(" ");
      }
      index = value2 + 2;
    }
  }
  function stripConditionalCssRules(css: string): string {
    let conditionalPattern: RegExp = /@(?:media|supports|container)\b/gi,
      parts: string[] = [],
      copyOffset = 0,
      offset: number = 0;
    for (
      let value = conditionalPattern.exec(css);
      value !== null && offset < css.length;
      value = conditionalPattern.exec(css)
    ) {
      for (
        offset = Math.max(offset, conditionalPattern.lastIndex);
        offset < css.length && !"{;}".includes(css.charAt(offset));

      ) {
        offset++;
      }
      if (css.charAt(offset) !== "{") {
        continue;
      }
      parts.push(css.slice(copyOffset, value.index));
      for (let count = 1; ++offset < css.length && count > 0; ) {
        count +=
          css.charAt(offset) === "{" ? 1 : css.charAt(offset) === "}" ? -1 : 0;
      }
      copyOffset = conditionalPattern.lastIndex = offset;
    }
    parts.push(css.slice(copyOffset));
    return parts.join(" ");
  }
  function bundleCssReadsTokens(
    bundleCss: string | null,
    tokensText: string | null,
    files: Core.FileTable,
  ) {
    if (bundleCss === null) {
      return false;
    }
    let cached = cssReadsTokensCache.find(
      (input) => input.css === bundleCss && input.tokens === tokensText,
    );
    if (cached !== undefined) {
      return cached.reads;
    }
    let tokensCss: string | null = (0, runtime.generatedTokensCssForFiles)(
        files,
      ),
      cssWithoutComments = stripCssComments(bundleCss),
      declaredVariables = new Set([
        ...firstRegexCaptureValues(
          stripConditionalCssRules(cssWithoutComments),
          CSS_VAR_DECLARATION_PATTERN,
        ),
        ...registeredCssPropertyNames(cssWithoutComments),
      ]),
      tokenVariables = new Set(
        tokensCss === null
          ? []
          : firstRegexCaptureValues(
              stripCssComments(tokensCss),
              CSS_VAR_DECLARATION_PATTERN,
            ),
      ),
      reads = firstRegexCaptureValues(
        cssWithoutComments,
        CSS_VAR_REFERENCE_PATTERN,
      ).some(
        (input) => !declaredVariables.has(input) && tokenVariables.has(input),
      );
    cssReadsTokensCache.unshift({
      css: bundleCss,
      tokens: tokensText,
      reads: reads,
    });
    cssReadsTokensCache.length = Math.min(cssReadsTokensCache.length, 2);
    return reads;
  }
  function consumptionDocumentationForFiles(files: Core.FileTable, root = "") {
    let cacheKey = [
        stringFileOrNull(files, runtime.DESIGN_SYSTEM_PATHS.readme),
        stringFileOrNull(files, runtime.DESIGN_SYSTEM_PATHS.tokens),
        stringFileOrNull(files, runtime.DESIGN_SYSTEM_PATHS.manifest),
        stringFileOrNull(files, runtime.DESIGN_SYSTEM_PATHS.indexDts),
        root,
        stringFileOrNull(files, runtime.DESIGN_SYSTEM_PATHS.bundleCss),
      ],
      assetReadmes: Record<string, string> = {};
    for (let value of Object.keys(files)) {
      if (
        value.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir) &&
        value.endsWith("/README.md") &&
        value.split("/").length === 3 &&
        typeof files[value] === "string"
      ) {
        assetReadmes[value] = files[value];
      }
    }
    let assetReadmeCacheKey = Object.entries<string>(assetReadmes).map(
        ([input, input2]): string =>
          input +
          `
` +
          input2,
      ).join(`

`),
      cached = consumptionDocumentationCache.find(
        (input) =>
          input.notes === assetReadmeCacheKey &&
          input.key.every(
            (input2, options): boolean => input2 === cacheKey[options],
          ),
      );
    if (cached !== undefined) {
      return cached.out;
    }
    let rawTokens = cacheKey[1] === null ? null : parseJsonOrNull(cacheKey[1]),
      documentation = generateConsumptionDocumentation({
        dts: cacheKey[3] ?? null,
        tokens:
          typeof rawTokens === "object" &&
          rawTokens !== null &&
          !Array.isArray(rawTokens)
            ? (0, runtime.parseTokens)(rawTokens)
            : null,
        manifest: (0, runtime.parseManifest)(cacheKey[2] ?? ""),
        readme: stripGeneratedReadmeTail(cacheKey[0] ?? ""),
        assetReadmes: assetReadmes,
        root: root,
        cssReadsTokens: bundleCssReadsTokens(
          cacheKey[5] ?? null,
          cacheKey[1] ?? null,
          files,
        ),
      });
    consumptionDocumentationCache.unshift({
      key: cacheKey,
      notes: assetReadmeCacheKey,
      out: documentation,
    });
    consumptionDocumentationCache.length = Math.min(
      consumptionDocumentationCache.length,
      2,
    );
    return documentation;
  }
  function generatedConsumptionReadme(files: Core.FileTable, root = "") {
    return consumptionDocumentationForFiles(files, root).readme;
  }
  bindRuntimeValue(
    runtime,
    "DEFAULT_TOKEN_CARD_MODE",
    () => DEFAULT_TOKEN_CARD_MODE,
    (value) => {
      DEFAULT_TOKEN_CARD_MODE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_CONSUMPTION_HEADING",
    () => GENERATED_CONSUMPTION_HEADING,
    (value) => {
      GENERATED_CONSUMPTION_HEADING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_INDEX_HEADING",
    () => GENERATED_INDEX_HEADING,
    (value) => {
      GENERATED_INDEX_HEADING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_INLINE_TOKENS_HEADING",
    () => GENERATED_INLINE_TOKENS_HEADING,
    (value) => {
      GENERATED_INLINE_TOKENS_HEADING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_README_SEPARATOR",
    () => GENERATED_README_SEPARATOR,
    (value) => {
      GENERATED_README_SEPARATOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STANDALONE_MIGRATION_HEADING",
    () => STANDALONE_MIGRATION_HEADING,
    (value) => {
      STANDALONE_MIGRATION_HEADING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STANDALONE_MIGRATION_PREFIXES",
    () => STANDALONE_MIGRATION_PREFIXES,
    (value) => {
      STANDALONE_MIGRATION_PREFIXES = value;
    },
  );
  bindRuntimeValue(runtime, "parseMarkdownFence", () => parseMarkdownFence);
  bindRuntimeValue(
    runtime,
    "inspectStandaloneMigrationGuide",
    () => inspectStandaloneMigrationGuide,
  );
  bindRuntimeValue(
    runtime,
    "STANDALONE_CONSUMPTION_GUIDANCE",
    () => STANDALONE_CONSUMPTION_GUIDANCE,
    (value) => {
      STANDALONE_CONSUMPTION_GUIDANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OMITTED_API_CARDS_NOTICE",
    () => OMITTED_API_CARDS_NOTICE,
    (value) => {
      OMITTED_API_CARDS_NOTICE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DOCS_GLOBAL_IDENTIFIER_PATTERN",
    () => DOCS_GLOBAL_IDENTIFIER_PATTERN,
    (value) => {
      DOCS_GLOBAL_IDENTIFIER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeMarkdownLine",
    () => sanitizeMarkdownLine,
    (value) => {
      sanitizeMarkdownLine = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeComponentGroupLabel",
    () => sanitizeComponentGroupLabel,
    (value) => {
      sanitizeComponentGroupLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_DOCUMENTED_COMPONENTS",
    () => MAX_DOCUMENTED_COMPONENTS,
    (value) => {
      MAX_DOCUMENTED_COMPONENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentationManifestFacts",
    () => documentationManifestFacts,
  );
  bindRuntimeValue(runtime, "humanizeFamilyName", () => humanizeFamilyName);
  bindRuntimeValue(
    runtime,
    "unicodeCharacterCount",
    () => unicodeCharacterCount,
    (value) => {
      unicodeCharacterCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "truncateUnicodeText",
    () => truncateUnicodeText,
    (value) => {
      truncateUnicodeText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "countSubstring",
    () => countSubstring,
    (value) => {
      countSubstring = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "uniqueValues",
    () => uniqueValues,
    (value) => {
      uniqueValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatCardCharacterCount",
    () => formatCardCharacterCount,
    (value) => {
      formatCardCharacterCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markdownCodeSpan",
    () => markdownCodeSpan,
    (value) => {
      markdownCodeSpan = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markdownTableCell",
    () => markdownTableCell,
    (value) => {
      markdownTableCell = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_CODE_FENCE",
    () => MARKDOWN_CODE_FENCE,
    (value) => {
      MARKDOWN_CODE_FENCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "joinEnglishList",
    () => joinEnglishList,
    (value) => {
      joinEnglishList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_INSTALL_PATH_SEGMENT_PATTERN",
    () => FONT_INSTALL_PATH_SEGMENT_PATTERN,
    (value) => {
      FONT_INSTALL_PATH_SEGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_INSTALL_PATH_PATTERN",
    () => FONT_INSTALL_PATH_PATTERN,
    (value) => {
      FONT_INSTALL_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isInstallableFontPath",
    () => isInstallableFontPath,
    (value) => {
      isInstallableFontPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OTHER_PAGE_FONT_GUIDANCE",
    () => OTHER_PAGE_FONT_GUIDANCE,
    (value) => {
      OTHER_PAGE_FONT_GUIDANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FONT_GUIDANCE",
    () => SLIDES_FONT_GUIDANCE,
    (value) => {
      SLIDES_FONT_GUIDANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontConsumptionGuide",
    () => fontConsumptionGuide,
    (value) => {
      fontConsumptionGuide = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_DOCUMENTATION_GROUPS",
    () => COLOR_DOCUMENTATION_GROUPS,
    (value) => {
      COLOR_DOCUMENTATION_GROUPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_INTERACTION_SUFFIX_PATTERN",
    () => COLOR_INTERACTION_SUFFIX_PATTERN,
    (value) => {
      COLOR_INTERACTION_SUFFIX_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PALETTE_RAMP_TOKEN_PATTERN",
    () => PALETTE_RAMP_TOKEN_PATTERN,
    (value) => {
      PALETTE_RAMP_TOKEN_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "makeApiDocumentationCard",
    () => makeApiDocumentationCard,
    (value) => {
      makeApiDocumentationCard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cachedComponentApiCards",
    () => cachedComponentApiCards,
    (value) => {
      cachedComponentApiCards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "generateComponentApiCards",
    () => generateComponentApiCards,
  );
  bindRuntimeValue(
    runtime,
    "groupDocumentedComponents",
    () => groupDocumentedComponents,
  );
  bindRuntimeValue(runtime, "fontFamilySlug", () => fontFamilySlug);
  bindRuntimeValue(
    runtime,
    "chooseRegularFontFace",
    () => chooseRegularFontFace,
  );
  bindRuntimeValue(
    runtime,
    "tokenFamilySlug",
    () => tokenFamilySlug,
    (value) => {
      tokenFamilySlug = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetDocumentationSlug",
    () => assetDocumentationSlug,
    (value) => {
      assetDocumentationSlug = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeTextNewlines",
    () => normalizeTextNewlines,
    (value) => {
      normalizeTextNewlines = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "generateConsumptionDocumentation",
    () => generateConsumptionDocumentation,
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_QUICK_START_HEADING",
    () => LEGACY_QUICK_START_HEADING,
    (value) => {
      LEGACY_QUICK_START_HEADING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_README_INSTRUCTIONS",
    () => LEGACY_README_INSTRUCTIONS,
    (value) => {
      LEGACY_README_INSTRUCTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "escapeRegexPattern",
    () => escapeRegexPattern,
    (value) => {
      escapeRegexPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "README_SEPARATOR_PATTERN_SOURCE",
    () => README_SEPARATOR_PATTERN_SOURCE,
    (value) => {
      README_SEPARATOR_PATTERN_SOURCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_MARKDOWN_FENCE",
    () => LEGACY_MARKDOWN_FENCE,
    (value) => {
      LEGACY_MARKDOWN_FENCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_README_HEADING_PATTERN_SOURCE",
    () => GENERATED_README_HEADING_PATTERN_SOURCE,
    (value) => {
      GENERATED_README_HEADING_PATTERN_SOURCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_README_START_PATTERN",
    () => GENERATED_README_START_PATTERN,
    (value) => {
      GENERATED_README_START_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_MANIFEST_FENCE_PATTERN_SOURCE",
    () => LEGACY_MANIFEST_FENCE_PATTERN_SOURCE,
    (value) => {
      LEGACY_MANIFEST_FENCE_PATTERN_SOURCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_README_SECTION_PATTERN",
    () => LEGACY_README_SECTION_PATTERN,
    (value) => {
      LEGACY_README_SECTION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_MANIFEST_FENCE_PATTERN",
    () => LEGACY_MANIFEST_FENCE_PATTERN,
    (value) => {
      LEGACY_MANIFEST_FENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_GENERATED_SECTION_PATTERN",
    () => LEGACY_GENERATED_SECTION_PATTERN,
    (value) => {
      LEGACY_GENERATED_SECTION_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "findLegacyReadmeTail", () => findLegacyReadmeTail);
  bindRuntimeValue(
    runtime,
    "generatedReadmeTailOffset",
    () => generatedReadmeTailOffset,
  );
  bindRuntimeValue(
    runtime,
    "stripGeneratedReadmeTail",
    () => stripGeneratedReadmeTail,
  );
  bindRuntimeValue(
    runtime,
    "stringFileOrNull",
    () => stringFileOrNull,
    (value) => {
      stringFileOrNull = value;
    },
  );
  bindRuntimeValue(runtime, "parseJsonOrNull", () => parseJsonOrNull);
  bindRuntimeValue(
    runtime,
    "CSS_VAR_REFERENCE_PATTERN",
    () => CSS_VAR_REFERENCE_PATTERN,
    (value) => {
      CSS_VAR_REFERENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_VAR_DECLARATION_PATTERN",
    () => CSS_VAR_DECLARATION_PATTERN,
    (value) => {
      CSS_VAR_DECLARATION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_PROPERTY_DECLARATION_PATTERN",
    () => CSS_PROPERTY_DECLARATION_PATTERN,
    (value) => {
      CSS_PROPERTY_DECLARATION_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "stripCssComments", () => stripCssComments);
  bindRuntimeValue(
    runtime,
    "stripConditionalCssRules",
    () => stripConditionalCssRules,
  );
  bindRuntimeValue(
    runtime,
    "firstRegexCaptureValues",
    () => firstRegexCaptureValues,
    (value) => {
      firstRegexCaptureValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registeredCssPropertyNames",
    () => registeredCssPropertyNames,
    (value) => {
      registeredCssPropertyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssReadsTokensCache",
    () => cssReadsTokensCache,
    (value) => {
      cssReadsTokensCache = value;
    },
  );
  bindRuntimeValue(runtime, "bundleCssReadsTokens", () => bundleCssReadsTokens);
  bindRuntimeValue(
    runtime,
    "consumptionDocumentationCache",
    () => consumptionDocumentationCache,
    (value) => {
      consumptionDocumentationCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "consumptionDocumentationForFiles",
    () => consumptionDocumentationForFiles,
  );
  bindRuntimeValue(
    runtime,
    "generatedConsumptionReadme",
    () => generatedConsumptionReadme,
  );
  return () => {
    DEFAULT_TOKEN_CARD_MODE = "single";
    GENERATED_CONSUMPTION_HEADING =
      "## Consuming this system (generated — do not edit)";
    GENERATED_INDEX_HEADING = "## Index (generated — do not edit)";
    GENERATED_INLINE_TOKENS_HEADING = "## Tokens (generated — do not edit)";
    GENERATED_README_SEPARATOR = `

---

`;
    STANDALONE_MIGRATION_HEADING = "## Migrated from the standalone version";
    STANDALONE_MIGRATION_PREFIXES = [
      "- **Design canvas:** copy `project/",
      "- **Slides deck:** copy `project/",
    ];
    STANDALONE_CONSUMPTION_GUIDANCE =
      "To bring this system onto a Design canvas or into a Slides deck, follow the lines “Design canvas” and “Slides deck” under “Migrated from the standalone version” above.";
    OMITTED_API_CARDS_NOTICE =
      "\n> The api/ cards indexed above are not beside this version: with them this system has more files than one version holds. Until it has fewer files, read `components/<Comp>/README.md` and `assets/<Group>/README.md` instead; token values are in `tokens.css`.\n";
    DOCS_GLOBAL_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
    sanitizeMarkdownLine = (input) =>
      input.replace(/[\r\n\u2028\u2029\uFFFD]+/g, " ");
    sanitizeComponentGroupLabel = (input) =>
      Array.from<string>(
        sanitizeMarkdownLine(input)
          .replace(/[*_`|<>[\]\\]+/g, " ")
          .replace(/ {2,}/g, " ")
          .trim(),
      )
        .slice(0, runtime.MAX_COMPONENT_GROUP_LABEL_LENGTH)
        .join("");
    MAX_DOCUMENTED_COMPONENTS = 1024;
    unicodeCharacterCount = (input): number => {
      let index: number = 0;
      for (let value of input) {
        index++;
      }
      return index;
    };
    truncateUnicodeText = (items, options) =>
      items.length <= options
        ? items
        : Array.from<string>(items).slice(0, options).join("");
    countSubstring = (input, options): number =>
      input.split(options).length - 1;
    uniqueValues = (input) => [...new Set(input)];
    formatCardCharacterCount = (input): string =>
      (input % 1000 === 250
        ? (Math.floor(input / 100) / 10).toFixed(1)
        : (input / 1000).toFixed(1)) + "k";
    markdownCodeSpan = (input) => {
      let value: number = Math.max(
          0,
          ...[...(input.match(/`+/g) ?? [])].map((items) => items.length),
        ),
        value2 = "`".repeat(value + 1);
      if (value === 0) {
        return value2 + input + value2;
      } else {
        return value2 + " " + input + " " + value2;
      }
    };
    markdownTableCell = (input) =>
      sanitizeMarkdownLine(input).replace(/\|/g, "\\|");
    MARKDOWN_CODE_FENCE = "```";
    joinEnglishList = (items) =>
      items.length < 2
        ? items.join("")
        : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
    FONT_INSTALL_PATH_SEGMENT_PATTERN =
      "[A-Za-z0-9_](?:(?:[A-Za-z0-9._-]| (?=[A-Za-z0-9_]))*[A-Za-z0-9_-])?";
    FONT_INSTALL_PATH_PATTERN = new RegExp(
      "^" +
        FONT_INSTALL_PATH_SEGMENT_PATTERN +
        "(?:/" +
        FONT_INSTALL_PATH_SEGMENT_PATTERN +
        ")*$",
    );
    isInstallableFontPath = (input) =>
      FONT_INSTALL_PATH_PATTERN.test(input) &&
      /\.(?:woff2?|ttf|otf)$/i.test(input) &&
      !/(?:^|\/)node_modules\//i.test(input);
    OTHER_PAGE_FONT_GUIDANCE =
      // CucCut: a font is a file in the system's directory (an id is its _blobs/<id>.<ext>), copied or imported with
      // the consumer's own tools, not the Artifact tool's read and publish.
      "one file per family is enough (below: the upright face nearest regular weight; bold and italic synthesize). Fetch it as the fetch column says (read the file: a path is in this system’s directory, an id is its " +
      markdownCodeSpan("_blobs/<id>.<ext>") +
      "), copy it beside your page or import it as an asset (" +
      markdownCodeSpan("design_import_asset") +
      ", where your tool lists that) and declare it with an " +
      markdownCodeSpan(
        '@font-face { font-family: "<family>"; src: url(<uploaded>) }',
      ) +
      " rule.";
    SLIDES_FONT_GUIDANCE =
      "- **Slides deck:** for each family you use in the deck (" +
      markdownCodeSpan("faces") +
      " holds at most the number of typefaces Slides’ " +
      markdownCodeSpan("deck-files.md") +
      " gives), install its file with the system and name the path it lands on as that family’s " +
      markdownCodeSpan("src") +
      " in " +
      markdownCodeSpan("project/deck.json") +
      " " +
      markdownCodeSpan("faces") +
      ", under the key in the Slides column. A deck takes a font as a file only under the rule in Slides’ " +
      markdownCodeSpan("fonts.md") +
      " (no space or leading underscore in its path, for two): any other font, or one kept by id, is uploaded as " +
      markdownCodeSpan("fonts.md") +
      " says.";
    fontConsumptionGuide = (input, options, context) => {
      let value = context[0] ?? "",
        items = [
          ...(input
            ? [
                "- **Design canvas:** copy " +
                  joinEnglishList(
                    [runtime.GENERATED_TOKENS_CSS_PATH, ...context].map(
                      markdownCodeSpan,
                    ),
                  ) +
                  " to the same paths under the canvas’s " +
                  markdownCodeSpan("project/ds/<folder>/") +
                  " (" +
                  markdownCodeSpan("<folder>") +
                  " is the folder you install this system under; " +
                  markdownCodeSpan(value) +
                  " lands on " +
                  markdownCodeSpan("project/ds/<folder>/" + value) +
                  "), in the same call that installs this system. Link that copy of " +
                  markdownCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH) +
                  " in the artboard’s " +
                  markdownCodeSpan("<head>") +
                  " as " +
                  markdownCodeSpan("ds/<folder>/tokens.css") +
                  ", or as Design’s instructions say for an artboard in a folder. If the install’s reply leaves a font out, bring that font in as for any other page.",
              ]
            : []),
          ...(options ? [SLIDES_FONT_GUIDANCE] : []),
        ];
      if (!options) {
        return [
          "Fonts: on a Design canvas, bring the fonts the “Design canvas” line of this system’s README names; in a Slides deck, the fonts its “Slides deck” line names. Both lines are under “Migrated from the standalone version”. Bring any font that line does not name as for any other page.",
          "",
          "- **Any other page:** " + OTHER_PAGE_FONT_GUIDANCE,
        ];
      }
      if (!input) {
        return ["Fonts: " + OTHER_PAGE_FONT_GUIDANCE, "", ...items];
      }
      return [
        "Fonts: " +
          markdownCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH) +
          " loads each font from its file, by path.",
        "",
        ...items,
        "- **Any other page:** " + OTHER_PAGE_FONT_GUIDANCE,
      ];
    };
    COLOR_DOCUMENTATION_GROUPS = [
      {
        key: "surface",
        title: "Surfaces",
        test: /^(?:surface|page|backdrop|background|canvas|paper|ground)/,
      },
      {
        key: "text",
        title: "Text",
        test: /^(?:text|oncolor|ink|fg|foreground)/,
      },
      {
        key: "fill",
        title: "Fills and status backgrounds",
        test: /^(?:fill|on|bg|accent)-/,
      },
      {
        key: "border",
        title: "Borders and rings",
        test: /^(?:border|ring|alpha|shadow-color|divider|stroke|outline|hairline)/,
      },
      {
        key: "chart",
        title: "Charts",
        test: /^chart-/,
      },
      {
        key: "palette",
        title: "Palette ramps and brand",
        test: /^/,
      },
    ];
    COLOR_INTERACTION_SUFFIX_PATTERN =
      /-(?:hover|hovered|active|pressed|disabled|focus)$/;
    PALETTE_RAMP_TOKEN_PATTERN = /^([a-z]+)-(\d+)$/;
    makeApiDocumentationCard = (input, options, context, value, extra) => ({
      kind: input,
      name: options,
      purpose: context,
      path: value,
      text: extra
        .join(
          `
`,
        )
        .replace(/\uFFFD/g, ""),
    });
    cachedComponentApiCards = null;
    tokenFamilySlug = (input) =>
      input
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "x";
    assetDocumentationSlug = (input) =>
      input.replace(/[^A-Za-z0-9_.]+/g, "-").replace(/^[-.]+|[-.]+$/g, "") ||
      "group";
    normalizeTextNewlines = (input) =>
      input.replace(
        /\r\n?/g,
        `
`,
      );
    LEGACY_QUICK_START_HEADING =
      "## Quick start (generated from tokens.json — do not edit)";
    LEGACY_README_INSTRUCTIONS =
      "Read this README first; the manifest below lists the files to read and every asset — read tokens.css or components/bundle.js only if the page you build uses them, and read_asset an asset id only if you need that asset.";
    escapeRegexPattern = (input) =>
      input.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
    README_SEPARATOR_PATTERN_SOURCE = "\\r?\\n\\r?\\n---\\r?\\n\\r?\\n";
    LEGACY_MARKDOWN_FENCE = "`".repeat(3);
    GENERATED_README_HEADING_PATTERN_SOURCE =
      escapeRegexPattern(GENERATED_CONSUMPTION_HEADING) +
      "|" +
      escapeRegexPattern(LEGACY_QUICK_START_HEADING);
    GENERATED_README_START_PATTERN = new RegExp(
      "(?:" +
        README_SEPARATOR_PATTERN_SOURCE +
        "|^)(?:" +
        GENERATED_README_HEADING_PATTERN_SOURCE +
        ")",
    );
    LEGACY_MANIFEST_FENCE_PATTERN_SOURCE =
      LEGACY_MARKDOWN_FENCE + 'json\\r?\\n\\{\\s*"manifestVersion"';
    LEGACY_README_SECTION_PATTERN = new RegExp(
      README_SEPARATOR_PATTERN_SOURCE +
        "(?=" +
        escapeRegexPattern(LEGACY_README_INSTRUCTIONS) +
        "|" +
        LEGACY_MANIFEST_FENCE_PATTERN_SOURCE +
        ")",
      "g",
    );
    LEGACY_MANIFEST_FENCE_PATTERN = new RegExp(
      LEGACY_MANIFEST_FENCE_PATTERN_SOURCE,
    );
    LEGACY_GENERATED_SECTION_PATTERN = new RegExp(
      README_SEPARATOR_PATTERN_SOURCE +
        "(?:" +
        GENERATED_README_HEADING_PATTERN_SOURCE +
        "|" +
        escapeRegexPattern(LEGACY_README_INSTRUCTIONS) +
        "|" +
        LEGACY_MANIFEST_FENCE_PATTERN_SOURCE +
        ")",
    );
    stringFileOrNull = (files: Core.FileTable, path: string) =>
      typeof files[path] === "string" ? files[path] : null;
    CSS_VAR_REFERENCE_PATTERN = /var\(\s*(--[A-Za-z0-9_-]+)\s*[,)]/gi;
    CSS_VAR_DECLARATION_PATTERN = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g;
    CSS_PROPERTY_DECLARATION_PATTERN = /@property\s+(--[A-Za-z0-9_-]+)\s*\{/gi;
    firstRegexCaptureValues = (input, options) =>
      [...input.matchAll(options)].map((input2) => input2[1]);
    registeredCssPropertyNames = (input) =>
      [...input.matchAll(CSS_PROPERTY_DECLARATION_PATTERN)].flatMap(
        (input2) => {
          let value = input.slice(
              input2.index + input2[0].length,
              input2.index + input2[0].length + 400,
            ),
            value2 = value.indexOf("}");
          if (
            value2 !== -1 &&
            /\binitial-value\s*:/i.test(value.slice(0, value2))
          ) {
            return [input2[1]];
          } else {
            return [];
          }
        },
      );
    cssReadsTokensCache = [];
    consumptionDocumentationCache = [];
  };
}
