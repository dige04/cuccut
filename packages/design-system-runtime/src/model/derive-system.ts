/** Restored application module; prepare first, initialize in original order. */
import type * as Core from "../contracts/model-core";
import type * as Model from "../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  DesignSystemContent,
  FileTable,
  ParseReport,
  ParsedDesignSystem,
} from "../contracts";
export function installModelDeriveSystem(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var hasBundleMetadata: (
    bundle: Pick<ParsedDesignSystem["bundle"], "namespace" | "declared">,
  ) => boolean;
  var DEFAULT_COVER_PREVIEW_HEIGHT: number;
  var DEFAULT_SHOWCASE_PREVIEW_WIDTH: number;
  var MOBILE_PREVIEW_HEIGHTS: Set<number>;
  var MOBILE_PREVIEW_LABEL_PATTERN: RegExp;
  var shouldUseDesktopShowcaseWidth: (
    metadata: Model.ComponentCardMetadata,
    name: string,
  ) => boolean;
  var UNGROUPED_ASSETS_NAME: string;
  var heldFileBaseUrl: string | undefined;
  var parsedDesignSystemCache: WeakMap<DesignSystemContent, ParsedDesignSystem>;
  var parsedDesignSystemBudgetCache: WeakMap<
    DesignSystemContent,
    WeakMap<Core.PageBudgetProvider, ParsedDesignSystem>
  >;
  var MAX_COMPONENT_SUMMARY_LENGTH: number;
  function parseDesignSystemContent(
    input: unknown,
    report?: ParseReport,
    options?: {
      unbounded?: boolean;
    },
  ): DesignSystemContent {
    let parseReport = report ?? (0, runtime.createParseReport)();
    parseReport.dropped.length = 0;
    parseReport.warnings.length = 0;
    let content = (0, runtime.isDesignSystemContentObject)(input) ? input : {};
    return {
      v: 2,
      files: (0, runtime.parseFileTable)(content.files, parseReport, options),
    };
  }
  function assetRelativeGroupKey(
    asset: Pick<Model.ParsedAsset, "name" | "subpath">,
  ) {
    if (asset.subpath !== "") {
      return asset.subpath + "/" + asset.name;
    } else {
      return asset.name;
    }
  }
  function isWallAssetKind(kind: Model.AssetKind) {
    return kind === "image" || kind === "svg";
  }
  function orderAssetTiles<Asset extends { key: string; wall: boolean }>(
    assets: Asset[],
    order: string[],
  ) {
    let rank = new Map(order.map((input, options) => [input, options])),
      rankForAsset = (input: Asset, options: number) =>
        rank.get(input.key) ?? order.length + options,
      sorted: Asset[] = assets
        .map((input, options): [Asset, number] => [
          input,
          rankForAsset(input, options),
        ])
        .sort((input, options) => input[1] - options[1])
        .map((input) => input[0]);
    return [
      ...sorted.filter((input) => input.wall),
      ...sorted.filter((input): boolean => !input.wall),
    ];
  }
  function markdownDocumentTitle(markdown: string) {
    return (
      markdown
        .replace(/^`{3,}[^`\n]*\n[\s\S]*?\n`{3,}/gm, "")
        .match(/^#\s+(.+)$/m)?.[1] ?? ""
    ).trim();
  }
  function humanizeDocumentFilename(path: string) {
    let title = (0, runtime.pathBasename)(path)
      .replace(/\.[^.]+$/, "")
      .replace(/^\d+[-_]/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (title === "") {
      return path;
    } else {
      return title.charAt(0).toUpperCase() + title.slice(1);
    }
  }
  function assetGroupSlug(name: string, usedSlugs?: Set<string>) {
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    if (slug === "") {
      slug = "group";
    }
    if (usedSlugs !== undefined) {
      let count: number = 2,
        value = slug;
      while (usedSlugs.has(slug)) {
        slug = value + "-" + String(count++);
      }
      usedSlugs.add(slug);
    }
    return slug;
  }
  function isClaudeEmulator() {
    let runtime2 = globalThis as Core.EmulatorFlags;
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    return (
      runtime2.designSystemHost?.__emulator === true ||
      runtime2.window?.designSystemHost?.__emulator === true
    );
  }
  function setHeldFileBaseUrl(baseUrl: string | undefined): void {
    heldFileBaseUrl = baseUrl;
  }
  function filePreviewUrl(
    files: FileTable,
    path: string,
    catalog?: Model.StorageCatalog,
  ) {
    let content = files[path];
    if (content === undefined) {
      return null;
    }
    let pointer = (0, runtime.storagePointerForFile)(path, content);
    if (pointer !== null) {
      if (pointer.store === "file") {
        if (
          heldFileBaseUrl !== undefined &&
          (0, runtime.isHeldFilePointer)(path, content)
        ) {
          return heldFileBaseUrl + (0, runtime.encodeRelativeUrlPath)(path);
        } else {
          return null;
        }
      }
      let value = catalog?.files[path];
      if (
        value !== undefined &&
        value.id === pointer.id &&
        value.url !== undefined &&
        isClaudeEmulator()
      ) {
        return value.url;
      } else {
        return (0, runtime.blobRelativeUrlModelFilePolicy)(pointer.id);
      }
    }
    if ((0, runtime.isTextFilePath)(path)) {
      return (
        "data:" +
        (0, runtime.mimeTypeForPath)(path) +
        ";charset=utf-8," +
        encodeURIComponent(content)
      );
    }
    if ((0, runtime.parseDataUriHeader)(content) !== null) {
      return content;
    } else {
      return null;
    }
  }
  function isDataUriUrl(url: string) {
    return /^data:/i.test(url);
  }
  function binaryFileBytes(
    files: FileTable,
    path: string,
    catalog: Model.StorageCatalog,
  ) {
    let content = files[path];
    if (content === undefined) {
      return 0;
    }
    if ((0, runtime.parseDataUriHeader)(content) !== null) {
      return (0, runtime.estimateDataUriBytes)(content);
    }
    return (0, runtime.storageRecordForFile)(files, catalog, path)?.bytes ?? 0;
  }
  function inferFontFamilyFromFilename(name: string) {
    return (
      name
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(
          /[-_](roman|regular|italic|italics|variable|web|bold|light|medium|\d+x\d+)/gi,
          "",
        )
        .replace(/[-_]+/g, " ")
        .trim() || name
    );
  }
  function parsedDesignSystem(
    content: DesignSystemContent,
    budgetProvider?: {
      pageBytes?(path: string): number | undefined;
    },
  ): ParsedDesignSystem {
    if (budgetProvider === undefined) {
      let entry = parsedDesignSystemCache.get(content);
      if (entry !== undefined) {
        return entry;
      }
      let value = parseDesignSystemFiles(content.files);
      parsedDesignSystemCache.set(content, value);
      return value;
    }
    let byBudget = parsedDesignSystemBudgetCache.get(content);
    if (byBudget === undefined) {
      parsedDesignSystemBudgetCache.set(content, (byBudget = new WeakMap()));
    }
    let cached = byBudget.get(budgetProvider);
    if (cached === undefined) {
      byBudget.set(
        budgetProvider,
        (cached = parseDesignSystemFiles(content.files, budgetProvider)),
      );
    }
    return cached;
  }
  function parseDesignSystemFiles(
    files: FileTable,
    budgetProvider?: {
      pageBytes?(path: string): number | undefined;
    },
  ): ParsedDesignSystem {
    let readme = files[runtime.DESIGN_SYSTEM_PATHS.readme] ?? "",
      tokensReport: ParseReport = {
        dropped: [],
        warnings: [],
      },
      tokens = (0, runtime.parseTokens)(
        files[runtime.DESIGN_SYSTEM_PATHS.tokens] ?? "",
        tokensReport,
      ),
      metaReport: ParseReport = {
        dropped: [],
        warnings: [],
      },
      manifest = (0, runtime.parseManifest)(
        files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
        metaReport,
      ),
      bundleMetadata = (0, runtime.parseManifestBundleMetadata)(
        manifest,
        metaReport,
      ),
      assetsMeta = (0, runtime.parseAssetGroupMetadata)(manifest, metaReport),
      lastChange = (0, runtime.lastChangeFromManifest)(manifest, metaReport),
      storage = (0, runtime.storageCatalogFromManifest)(manifest, metaReport),
      sectionTitles = (0, runtime.sectionTitlesFromManifest)(manifest),
      bundleJs = files[runtime.DESIGN_SYSTEM_PATHS.bundleJs] ?? null,
      bundleHeader =
        bundleJs !== null ? (0, runtime.parseBundleHeader)(bundleJs) : null,
      namespace = bundleHeader?.namespace ?? bundleMetadata.namespace ?? null,
      hasLibraryFile = (input: string) =>
        (0, runtime.classifyDesignSystemFile)(input) === "componentLib" &&
        Object.hasOwn(files, input),
      declaredLibraries = bundleMetadata.libraries ?? [],
      inferredLibraries =
        bundleJs !== null
          ? (0, runtime.inferDeclaredLibraries)(
              declaredLibraries,
              hasLibraryFile,
            )
          : declaredLibraries,
      libraries = (0, runtime.resolvePreviewLibraries)(
        inferredLibraries,
        hasLibraryFile,
      ),
      loadedLibraryPaths = new Set(libraries.load.map((input) => input.file)),
      declarations: { path: string; text: string }[] = [],
      componentFiles = new Map<string, Core.ComponentFileSources>(),
      docs: ParsedDesignSystem["docs"] = [],
      docsLeftOut: string[] = [],
      otherFiles: string[] = [];
    for (let value of Object.keys(files).sort()) {
      let value2 = (0, runtime.classifyDesignSystemFile)(value);
      if (value2 === "doc") {
        let value3 = files[value];
        if (
          docs.length < runtime.MAX_DISPLAYED_DOCUMENTS &&
          (budgetProvider?.pageBytes?.(value) ??
            (0, runtime.estimateEmbeddedStringBytes)(value3)) <=
            runtime.DESIGN_SYSTEM_INLINE_LIMITS.readme
        ) {
          docs.push({
            path: value,
            title:
              markdownDocumentTitle(value3) || humanizeDocumentFilename(value),
            markdown: value3,
          });
        } else {
          docsLeftOut.push(value);
        }
      }
      if (
        value2 === "dts" &&
        !value.startsWith(runtime.DESIGN_SYSTEM_PATHS.archivedDir)
      ) {
        declarations.push({
          path: value,
          text: files[value],
        });
      }
      if (
        value2 === "preview" ||
        value2 === "componentReadme" ||
        (value2 === "dts" &&
          value.startsWith(runtime.DESIGN_SYSTEM_PATHS.componentsDir))
      ) {
        let value3 = value
            .slice(runtime.DESIGN_SYSTEM_PATHS.componentsDir.length)
            .split("/"),
          value4 = value3[0];
        if (
          value3.length !== 2 ||
          !runtime.COMPONENT_NAME_PATTERN.test(value4)
        ) {
          if (value2 !== "dts") {
            otherFiles.push(value);
          }
          continue;
        }
        if (value2 === "dts" && value3[1] !== value4 + ".d.ts") {
          continue;
        }
        let value5 = componentFiles.get(value4) ?? {
          preview: null,
          readme: null,
          dts: null,
        };
        if (value2 === "preview") {
          value5.preview = files[value];
        } else if (value2 === "componentReadme") {
          value5.readme = files[value];
        } else {
          value5.dts = value;
        }
        componentFiles.set(value4, value5);
      } else if (value2 === "componentLib") {
        if (!loadedLibraryPaths.has(value)) {
          otherFiles.push(value);
        }
      } else if (value2 === "componentOther" || value2 === "other") {
        otherFiles.push(value);
      }
    }
    declarations.sort((input, options): number =>
      input.path === runtime.DESIGN_SYSTEM_PATHS.indexDts
        ? -1
        : options.path === runtime.DESIGN_SYSTEM_PATHS.indexDts
          ? 1
          : input.path < options.path
            ? -1
            : 1,
    );
    let coverFiles = componentFiles.get(runtime.COVER_COMPONENT_NAME),
      coverPreview =
        bundleHeader?.components.includes(runtime.COVER_COMPONENT_NAME) ===
          true ||
        coverFiles?.readme != null ||
        coverFiles?.dts != null
          ? null
          : (coverFiles?.preview ?? null),
      cover =
        coverPreview !== null
          ? {
              previewHtml: coverPreview,
              height:
                (0, runtime.componentCardMetadata)(coverPreview)?.height ??
                DEFAULT_COVER_PREVIEW_HEIGHT,
            }
          : null,
      components: Model.ParsedComponent[] = [],
      componentNames = new Set<string>(),
      addComponent = (input: string, options: "header" | "files"): void => {
        if (
          componentNames.has(input) ||
          (input === runtime.COVER_COMPONENT_NAME && coverPreview !== null)
        ) {
          return;
        }
        componentNames.add(input);
        let entry = componentFiles.get(input),
          value = entry?.preview ?? null,
          value2 =
            value !== null ? (0, runtime.componentCardMetadata)(value) : null,
          value3: string | null =
            entry?.readme != null
              ? runtime.DESIGN_SYSTEM_PATHS.componentsDir +
                input +
                "/" +
                runtime.COMPONENT_FILENAMES.readme
              : null,
          value4 = value2?.page === true && options !== "header";
        components.push({
          name: input,
          previewHtml: value,
          guidelinesMd: value3 !== null ? files[value3] : null,
          guidelinesPath: value3,
          dts: entry?.dts != null ? files[entry.dts] : null,
          dtsPath: entry?.dts ?? null,
          group: value2?.group ?? "",
          subtitle: value2?.subtitle ?? "",
          floor: value2?.floor === true,
          page: value4,
          previewHeight:
            value2?.height ?? runtime.DEFAULT_COMPONENT_PREVIEW_HEIGHT,
          previewWidth:
            value2?.width ??
            (value2 !== null &&
            value4 &&
            shouldUseDesktopShowcaseWidth(value2, input)
              ? DEFAULT_SHOWCASE_PREVIEW_WIDTH
              : null),
          listedBy: options,
        });
      };
    if (bundleHeader !== null) {
      for (let value of bundleHeader.components) {
        addComponent(value, "header");
      }
    }
    for (let value of [...componentFiles.keys()].sort()) {
      if (
        componentFiles.get(value)?.preview != null ||
        componentFiles.get(value)?.readme != null
      ) {
        addComponent(value, "files");
      }
    }
    let fonts: Model.ParsedFont[] = [],
      fontPaths = new Set<string>(),
      makeFont = (
        input: Model.FontFace | null,
        options: string,
      ): Model.ParsedFont => {
        let value = files[options],
          value2 = (0, runtime.pathBasename)(options);
        return {
          path: options,
          fileName: value2,
          family:
            input !== null ? input.family : inferFontFamilyFromFilename(value2),
          weight: input !== null ? input.weight : "400",
          style:
            input !== null
              ? input.style
              : /italic/i.test(value2)
                ? "italic"
                : "normal",
          format: (0, runtime.fileExtension)(options),
          src:
            value !== undefined &&
            ((0, runtime.parseDataUriHeader)(value) !== null ||
              (0, runtime.storagePointerForFile)(options, value) !== null)
              ? (filePreviewUrl(files, options, storage) ?? "")
              : "",
          store:
            value !== undefined
              ? (0, runtime.storageKindForFile)(options, value)
              : "inline",
          bytes: binaryFileBytes(files, options, storage),
          referenced: input !== null,
          missing: value === undefined,
        };
      };
    for (let value of tokens.type.fonts) {
      fonts.push(makeFont(value, value.file));
      fontPaths.add(value.file);
    }
    for (let value of Object.keys(files)) {
      if (
        value.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir) &&
        !fontPaths.has(value)
      ) {
        fonts.push(makeFont(null, value));
      }
    }
    let assetsByGroup = new Map<string, Model.ParsedAsset[]>(),
      assetCount: number = 0;
    for (let value of Object.keys(files)) {
      if (!value.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
        continue;
      }
      let value2 = value
          .slice(runtime.DESIGN_SYSTEM_PATHS.assetsDir.length)
          .split("/"),
        value3 = value2.pop()!,
        value4 = value2.length > 0 ? value2.shift()! : UNGROUPED_ASSETS_NAME,
        value5 = value2.join("/"),
        value6 = files[value],
        value7 =
          (0, runtime.isTextFilePath)(value) &&
          (0, runtime.storagePointerForFile)(value, value6) === null,
        state: Model.ParsedAsset = {
          path: value,
          name: value3,
          group: value4,
          subpath: value5,
          ext: (0, runtime.fileExtension)(value),
          mime: (0, runtime.mimeTypeForPath)(value),
          kind: (0, runtime.assetKindForPath)(value),
          isText: value7,
          store: (0, runtime.storageKindForFile)(value, value6),
          bytes: value7
            ? value6.length
            : binaryFileBytes(files, value, storage),
        },
        value8 = assetsByGroup.get(value4) ?? [];
      value8.push(state);
      assetsByGroup.set(value4, value8);
      assetCount++;
    }
    let groupNames = [
        ...assetsMeta.groups.filter((input) => assetsByGroup.has(input)),
        ...[...assetsByGroup.keys()].filter(
          (input): boolean => !assetsMeta.groups.includes(input),
        ),
      ],
      usedSlugs = new Set<string>(),
      assetGroups = groupNames.map((input) => {
        let entry = assetsByGroup.get(input)!,
          values = new Set(
            entry.map((input2) => assetRelativeGroupKey(input2)),
          ),
          value = (
            (0, runtime.ownPropertyOrUndefined)(assetsMeta.orders, input) ?? []
          ).filter((input2) => values.has(input2)),
          value2 = orderAssetTiles(
            entry.map((source) => ({
              key: assetRelativeGroupKey(source),
              wall: isWallAssetKind(source.kind),
              a: source,
            })),
            value,
          ).map((input2) => input2.a);
        return {
          name: input,
          slug: assetGroupSlug(input, usedSlugs),
          tile:
            (0, runtime.ownPropertyOrUndefined)(assetsMeta.tiles, input) ??
            runtime.DEFAULT_ASSET_TILE_SIZE,
          order: value,
          assets: value2,
        };
      });
    return {
      files: files,
      readme: readme,
      docs: docs,
      docsLeftOut: docsLeftOut,
      tokens: tokens,
      tokensReport: tokensReport,
      assetsMeta: assetsMeta,
      lastChange: lastChange,
      sectionTitles: sectionTitles,
      metaReport: metaReport,
      bundle: {
        js: bundleJs,
        css: files[runtime.DESIGN_SYSTEM_PATHS.bundleCss] ?? null,
        dts: declarations,
        header: bundleHeader,
        namespace: namespace,
        declared: inferredLibraries,
        libraries: libraries,
        jsBytes:
          bundleJs !== null
            ? (0, runtime.estimateEmbeddedStringBytes)(bundleJs)
            : 0,
      },
      components: components,
      cover: cover,
      fonts: fonts,
      assetFonts: assetGroups.flatMap((input) =>
        input.assets
          .filter((source): boolean => source.kind === "font")
          .map((input2) => makeFont(null, input2.path)),
      ),
      assetGroups: assetGroups,
      assetCount: assetCount,
      otherFiles: otherFiles.sort(),
      storage: storage,
      blobBytesUsed: (0, runtime.uniqueStoredBlobBytes)(storage),
      bytes: (0, runtime.computeFileBudgetUsage)(
        files,
        (input) =>
          (0, runtime.storageRecordForFile)(files, storage, input)?.bytes ?? 0,
        (input) => budgetProvider?.pageBytes?.(input),
      ),
    };
  }
  function componentGuidelineSummary(markdown: string | null) {
    if (markdown === null) {
      return "";
    }
    return summarizeMarkdownParagraph(firstMarkdownParagraphLines(markdown));
  }
  function firstMarkdownParagraphLines(markdown: string) {
    let inFence: boolean = false,
      htmlTerminator: string | null = null,
      lines: string[] = [];
    for (let value of markdown.split(/\r?\n/)) {
      let value2 = value.trim();
      if (htmlTerminator !== null) {
        if (value2.includes(htmlTerminator)) {
          htmlTerminator = null;
        }
        continue;
      }
      if (
        /^~~~/.test(value2) ||
        (/^```/.test(value2) && !value2.replace(/^`+/, "").includes("`"))
      ) {
        inFence = !inFence;
        if (lines.length > 0) {
          break;
        }
        continue;
      }
      if (inFence) {
        continue;
      }
      if (value2 === "") {
        if (lines.length > 0) {
          break;
        }
        continue;
      }
      if (value2.startsWith("<\!--") && !value2.includes("-->")) {
        htmlTerminator = "-->";
        if (lines.length > 0) {
          break;
        }
        continue;
      }
      if (/^<\/?[!A-Za-z][^>]*$/.test(value2)) {
        htmlTerminator = ">";
        if (lines.length > 0) {
          break;
        }
        continue;
      }
      if (/^(={3,}|-{3,})$/.test(value2) && lines.length === 1) {
        lines.length = 0;
        continue;
      }
      if (
        /^#{1,6}(\s|$)/.test(value2) ||
        /^(-{3,}|\*{3,}|_{3,}|={3,})$/.test(value2) ||
        value2.startsWith("|") ||
        /^<\/?[!A-Za-z][^>]*>?$/.test(value2) ||
        /^(import|export)\s/.test(value2)
      ) {
        if (lines.length > 0) {
          break;
        }
        continue;
      }
      lines.push(value2);
    }
    return lines;
  }
  function summarizeMarkdownParagraph(lines: string[]) {
    let plainText = lines.join(" ");
    plainText = plainText
      .replace(/<\!--[\s\S]*?-->/g, " ")
      .replace(/<\/?[A-Za-z][^>]*>/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
      .replace(/^\s*>\s*/, "")
      .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (plainText === "") {
      return "";
    }
    let sentenceEnd = /[.!?](?=\s+[A-Z0-9"'\u201c\u2018(\[]|\s*$)/.exec(
        plainText,
      ),
      summary =
        sentenceEnd !== null
          ? plainText.slice(0, sentenceEnd.index + 1)
          : plainText;
    if (Array.from(summary).length > MAX_COMPONENT_SUMMARY_LENGTH) {
      summary =
        Array.from(summary)
          .slice(0, MAX_COMPONENT_SUMMARY_LENGTH - 1)
          .join("")
          .trimEnd() + "…";
    }
    return summary;
  }
  function componentManifestEntry(component: Model.ParsedComponent) {
    let entry: Core.ComponentManifestEntry = {
      name: component.name,
    };
    if (component.group !== "") {
      entry.group = component.group;
    }
    let summary = componentGuidelineSummary(component.guidelinesMd);
    if (summary !== "") {
      entry.summary = summary;
    }
    if (component.page) {
      entry.page = true;
    }
    return entry;
  }
  function manifestMirrorFilePaths(files: FileTable) {
    let paths =
      (0, runtime.generatedTokensCssForFiles)(files) !== null
        ? [runtime.GENERATED_TOKENS_CSS_PATH]
        : [];
    for (let value of Object.keys(files)) {
      if (
        (0, runtime.isMirrorEligibleFile)(value, files[value]) &&
        value !== runtime.DESIGN_SYSTEM_PATHS.readme &&
        value !== runtime.DESIGN_SYSTEM_PATHS.manifest &&
        value !== runtime.DESIGN_SYSTEM_PATHS.tokens &&
        !value.startsWith(runtime.DESIGN_SYSTEM_PATHS.archivedDir) &&
        (0, runtime.explainUnsafeMirrorPath)(value) === null
      ) {
        paths.push(value);
      }
    }
    return paths.sort();
  }
  function buildDesignSystemManifest(system: ParsedDesignSystem, name: string): Core.DesignSystemManifestResult {
    let lastChange = (0, runtime.serializeLastChange)(system.lastChange),
      storage: Model.StorageCatalog = (0, runtime.reconcileStorageCatalog)(
        system.files,
        system.storage,
      ),
      serializedStorage = (0, runtime.serializeStorageCatalog)(storage),
      sections = (0, runtime.serializeSectionTitles)(system.sectionTitles);
    return {
      manifestVersion: runtime.DESIGN_SYSTEM_MANIFEST_VERSION,
      name: name,
      namespace: system.bundle.namespace,
      files: manifestMirrorFilePaths(system.files),
      libraries: (0, runtime.serializeResolvedLibraries)(
        system.bundle.declared,
        system.bundle.libraries,
      ),
      components: system.components.map(componentManifestEntry),
      ...(lastChange !== undefined
        ? {
            lastChange: lastChange,
          }
        : {}),
      assetGroups: system.assetGroups.map((input) => {
        let value = input.assets.flatMap((input2) => {
          let value2 = storage.files[input2.path]?.id;
          if (value2 !== undefined) {
            return [
              {
                path: input2.path,
                id: value2,
              },
            ];
          } else {
            return [];
          }
        });
        return {
          name: input.name,
          ...(input.tile !== runtime.DEFAULT_ASSET_TILE_SIZE
            ? {
                tile: input.tile,
              }
            : {}),
          ...(input.order.length > 0
            ? {
                order: input.order,
              }
            : {}),
          ...(value.length > 0
            ? {
                files: value,
              }
            : {}),
        };
      }),
      ...(serializedStorage !== undefined
        ? {
            storage: serializedStorage,
          }
        : {}),
      ...(sections !== undefined
        ? {
            sections: sections,
          }
        : {}),
    };
  }
  function serializeDesignSystemManifest(manifest: unknown) {
    return stringifyManifestWithinBudget(manifest);
  }
  function stringifyManifestWithinBudget(manifest: unknown): string {
    let pretty: string =
      JSON.stringify(manifest, null, 2) +
      `
`;
    if (
      (0, runtime.estimateEmbeddedStringBytes)(pretty) <=
      runtime.MAX_PRETTY_MANIFEST_BYTES
    ) {
      return pretty;
    }
    return (
      JSON.stringify(manifest) +
      `
`
    );
  }
  bindRuntimeValue(
    runtime,
    "parseDesignSystemContent",
    () => parseDesignSystemContent,
  );
  bindRuntimeValue(
    runtime,
    "assetRelativeGroupKey",
    () => assetRelativeGroupKey,
  );
  bindRuntimeValue(runtime, "isWallAssetKind", () => isWallAssetKind);
  bindRuntimeValue(runtime, "orderAssetTiles", () => orderAssetTiles);
  bindRuntimeValue(
    runtime,
    "hasBundleMetadata",
    () => hasBundleMetadata,
    (value) => {
      hasBundleMetadata = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_COVER_PREVIEW_HEIGHT",
    () => DEFAULT_COVER_PREVIEW_HEIGHT,
    (value) => {
      DEFAULT_COVER_PREVIEW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markdownDocumentTitle",
    () => markdownDocumentTitle,
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_SHOWCASE_PREVIEW_WIDTH",
    () => DEFAULT_SHOWCASE_PREVIEW_WIDTH,
    (value) => {
      DEFAULT_SHOWCASE_PREVIEW_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MOBILE_PREVIEW_HEIGHTS",
    () => MOBILE_PREVIEW_HEIGHTS,
    (value) => {
      MOBILE_PREVIEW_HEIGHTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MOBILE_PREVIEW_LABEL_PATTERN",
    () => MOBILE_PREVIEW_LABEL_PATTERN,
    (value) => {
      MOBILE_PREVIEW_LABEL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shouldUseDesktopShowcaseWidth",
    () => shouldUseDesktopShowcaseWidth,
    (value) => {
      shouldUseDesktopShowcaseWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "humanizeDocumentFilename",
    () => humanizeDocumentFilename,
  );
  bindRuntimeValue(
    runtime,
    "UNGROUPED_ASSETS_NAME",
    () => UNGROUPED_ASSETS_NAME,
    (value) => {
      UNGROUPED_ASSETS_NAME = value;
    },
  );
  bindRuntimeValue(runtime, "assetGroupSlug", () => assetGroupSlug);
  bindRuntimeValue(runtime, "isClaudeEmulator", () => isClaudeEmulator);
  bindRuntimeValue(
    runtime,
    "heldFileBaseUrl",
    () => heldFileBaseUrl,
    (value) => {
      heldFileBaseUrl = value;
    },
  );
  bindRuntimeValue(runtime, "setHeldFileBaseUrl", () => setHeldFileBaseUrl);
  bindRuntimeValue(runtime, "filePreviewUrl", () => filePreviewUrl);
  bindRuntimeValue(runtime, "isDataUriUrl", () => isDataUriUrl);
  bindRuntimeValue(runtime, "binaryFileBytes", () => binaryFileBytes);
  bindRuntimeValue(
    runtime,
    "inferFontFamilyFromFilename",
    () => inferFontFamilyFromFilename,
  );
  bindRuntimeValue(
    runtime,
    "parsedDesignSystemCache",
    () => parsedDesignSystemCache,
    (value) => {
      parsedDesignSystemCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parsedDesignSystemBudgetCache",
    () => parsedDesignSystemBudgetCache,
    (value) => {
      parsedDesignSystemBudgetCache = value;
    },
  );
  bindRuntimeValue(runtime, "parsedDesignSystem", () => parsedDesignSystem);
  bindRuntimeValue(
    runtime,
    "parseDesignSystemFiles",
    () => parseDesignSystemFiles,
  );
  bindRuntimeValue(
    runtime,
    "MAX_COMPONENT_SUMMARY_LENGTH",
    () => MAX_COMPONENT_SUMMARY_LENGTH,
    (value) => {
      MAX_COMPONENT_SUMMARY_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "componentGuidelineSummary",
    () => componentGuidelineSummary,
  );
  bindRuntimeValue(
    runtime,
    "firstMarkdownParagraphLines",
    () => firstMarkdownParagraphLines,
  );
  bindRuntimeValue(
    runtime,
    "summarizeMarkdownParagraph",
    () => summarizeMarkdownParagraph,
  );
  bindRuntimeValue(
    runtime,
    "componentManifestEntry",
    () => componentManifestEntry,
  );
  bindRuntimeValue(
    runtime,
    "manifestMirrorFilePaths",
    () => manifestMirrorFilePaths,
  );
  bindRuntimeValue(
    runtime,
    "buildDesignSystemManifest",
    () => buildDesignSystemManifest,
  );
  bindRuntimeValue(
    runtime,
    "serializeDesignSystemManifest",
    () => serializeDesignSystemManifest,
  );
  bindRuntimeValue(
    runtime,
    "stringifyManifestWithinBudget",
    () => stringifyManifestWithinBudget,
  );
  return () => {
    hasBundleMetadata = (input) =>
      input.namespace !== null || input.declared.length > 0;
    DEFAULT_COVER_PREVIEW_HEIGHT = 280;
    DEFAULT_SHOWCASE_PREVIEW_WIDTH = 1280;
    MOBILE_PREVIEW_HEIGHTS = new Set([
      736, 780, 812, 844, 852, 874, 896, 915, 926, 932, 956, 1112, 1133, 1180,
      1194, 1366,
    ]);
    MOBILE_PREVIEW_LABEL_PATTERN =
      /mobile|android|tablet|iphone|ipad|smartphone|(^|[^a-z])(ios|phone)/;
    shouldUseDesktopShowcaseWidth = (input, options): boolean => {
      let value = input.height ?? 0;
      if (
        value < 700 ||
        MOBILE_PREVIEW_HEIGHTS.has(value) ||
        /^components?$/i.test((input.group ?? "").trim())
      ) {
        return false;
      }
      let value2 = [
        input.group,
        options,
        options.replace(/([a-z\d])([A-Z])/g, "$1 $2"),
        input.subtitle,
      ]
        .join(" ")
        .toLowerCase();
      return !MOBILE_PREVIEW_LABEL_PATTERN.test(value2);
    };
    UNGROUPED_ASSETS_NAME = "Other";
    parsedDesignSystemCache = new WeakMap();
    parsedDesignSystemBudgetCache = new WeakMap();
    MAX_COMPONENT_SUMMARY_LENGTH = 160;
  };
}
