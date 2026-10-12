import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorViewModel(runtime: RuntimeBindings): () => void {
  var optionalNonemptyText: (text: string | undefined) => string | undefined;
  var ASSETS_SECTION_LABEL: string;
  var assetGroupDisplayName: (group: string) => string;
  var extraTokenFamilySectionId: (key: string) => string;
  var STARTER_SECTION_IDS: string[];
  function tokenGroupRenamePairs(
    names: string[],
    namespace: string,
    previousGroup: string,
    nextGroup: string,
  ): [string, string][] {
    let items: [string, string][] = [];
    for (let value of names) {
      let value2 =
          namespace !== "" &&
          value.startsWith(namespace) &&
          value.length > namespace.length
            ? namespace
            : "",
        value3 = value.slice(value2.length);
      if (previousGroup === "") {
        items.push([value, value2 + nextGroup + "-" + value3]);
        continue;
      }
      if (value3 !== previousGroup && !value3.startsWith(previousGroup + "-")) {
        continue;
      }
      items.push([
        value,
        value2 + nextGroup + value3.slice(previousGroup.length),
      ]);
    }
    return items;
  }
  function colorGroupsForEditor(
    tokens: Model.NormalizedTokens,
  ): Application.EditorColorGroup[] {
    return (0, runtime.groupColorPaletteTokens)(tokens).map(
      (input: {
        name: string;
        tokens: Model.ColorToken[];
        numeric?: boolean;
      }) => ({
        name: input.name,
        tokens: input.tokens.map((input2: Model.ColorToken) => {
          let value: Application.EditorColorToken["alias"];
          for (let value2 of tokens.color.themes) {
            let value3 = (0, runtime.colorAliasTarget)(
              (0, runtime.colorValueForThemeModelTokens)(
                input2,
                value2.id,
                tokens,
              ),
            );
            if (value3 !== undefined) {
              (value ??= {})[value2.id] = {
                to: value3,
                css: (0, runtime.resolveColorTokenValue)(
                  input2,
                  value2.id,
                  tokens,
                ),
              };
            }
          }
          return {
            name: input2.name,
            value: input2.value,
            alias: value,
            usage: optionalNonemptyText(input2.usage),
          };
        }),
        ...(input.numeric
          ? {
              numeric: true,
            }
          : {}),
      }),
    );
  }
  function typeGroupsForEditor(
    groups: Model.TypographyGroup[],
  ): Application.EditorTypeGroup[] {
    return groups.map((input) => ({
      name: input.name,
      family: input.family,
      note: optionalNonemptyText(input.note),
      styles: input.styles.map((input2) => ({
        name: input2.name,
        fontSize: input2.fontSize,
        lineHeight: input2.lineHeight,
        fontWeight: input2.fontWeight,
        letterSpacing: input2.letterSpacing,
        fontStyle: input2.fontStyle,
        opticalSize: input2.opticalSize ?? undefined,
        familyKey: input2.family !== "" ? input2.family : undefined,
        sample: optionalNonemptyText(input2.sample),
        usage: optionalNonemptyText(input2.usage),
      })),
    }));
  }
  function fontFamiliesForEditor(
    families: Record<string, string>,
    fonts: Model.ParsedFont[],
  ): Record<string, string> {
    let state: Record<string, string> = {};
    for (let [value, value2] of Object.entries(families)) {
      let value3 = firstCssFontFamily(value2),
        value4 = fonts
          .filter(
            (input) =>
              !input.missing &&
              input.src !== "" &&
              value3 !== null &&
              input.family.toLowerCase() === value3.toLowerCase(),
          )
          .map((input) => input.path);
      state[value] =
        value3 === null
          ? value2
          : (0, runtime.fontFamilyStack)(value3, value4) + ", " + value2;
    }
    return state;
  }
  function firstCssFontFamily(value: string): string | null {
    let match = /^\s*(?:"([^"]{1,80})"|'([^']{1,80})'|([^,'"]{1,80}))/.exec(
      value,
    );
    if (match === null) {
      return null;
    }
    let family = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (family === "") {
      return null;
    } else {
      return family;
    }
  }
  function fontFilesForEditor(
    fonts: Model.ParsedFont[],
    assetFonts: Model.ParsedFont[] = [],
  ): Application.EditorFont[] {
    let callback = (
      input: Model.ParsedFont,
      options: boolean,
    ): Application.EditorFont => ({
      path: input.path,
      family: input.family,
      weight: input.weight,
      style: input.style,
      format: input.format,
      missing: input.missing,
      stray: !input.referenced,
      ...(options
        ? {
            asset: true,
          }
        : {}),
    });
    return [
      ...fonts.map((input) => callback(input, false)),
      ...assetFonts.map((input) => callback(input, true)),
    ];
  }
  function tokenScaleForEditor(
    scale: Model.TokenFamily,
  ): Application.EditorScale {
    return {
      note: optionalNonemptyText(scale.note),
      tokens: scale.tokens.map((input) => ({
        name: input.name,
        value: input.value,
        usage: optionalNonemptyText(input.usage),
      })),
    };
  }
  function humanizeTokenFamily(key: string): string {
    let label = key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .trim()
      .toLowerCase();
    if (label === "") {
      return key;
    } else {
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  function extraTokenFamiliesForEditor(
    tokens: Model.NormalizedTokens,
  ): Application.EditorExtraScale[] {
    return tokens.extra
      .filter((input): boolean => input.tokens.length > 0)
      .map((input) => ({
        key: input.key,
        id: "family:" + input.key,
        title: humanizeTokenFamily(input.key),
        scale: tokenScaleForEditor(input),
      }));
  }
  function documentSectionsForEditor(
    docs: Model.ParsedDesignSystem["docs"],
  ): Application.ApplicationView["docs"] {
    return docs.map((input) => ({
      path: input.path,
      id: "doc:" + input.path,
      title: input.title,
      markdown: input.markdown,
    }));
  }
  function shadowScaleForEditor(
    tokens: Model.NormalizedTokens,
  ): Application.ApplicationView["shadows"] {
    return {
      note: optionalNonemptyText(tokens.shadow.note),
      tokens: tokens.shadow.tokens.map((input) => ({
        name: input.name,
        value: Object.fromEntries(
          tokens.color.themes.map((input2) => [
            input2.id,
            (0, runtime.shadowValueForTheme)(input, input2.id, tokens),
          ]),
        ),
        usage: optionalNonemptyText(input.usage),
      })),
    };
  }
  function componentsForEditor(
    components: Model.ParsedComponent[],
  ): Application.EditorComponent[] {
    return components.map((input) => ({
      name: input.name,
      previewHtml: input.previewHtml ?? undefined,
      previewHeight: input.previewHeight,
      ...(input.previewWidth !== null
        ? {
            previewWidth: input.previewWidth,
          }
        : {}),
      guidelines: input.guidelinesMd ?? undefined,
      ...(input.guidelinesPath !== null
        ? {
            guidelinesPath: input.guidelinesPath,
          }
        : {}),
      ...(input.dts !== null
        ? {
            types: input.dts,
          }
        : {}),
      ...(input.group !== ""
        ? {
            group: input.group,
          }
        : {}),
      ...(input.subtitle !== ""
        ? {
            subtitle: input.subtitle,
          }
        : {}),
      ...(input.floor
        ? {
            floor: true,
          }
        : {}),
    }));
  }
  function assetForEditor(asset: Model.ParsedAsset): Application.EditorAsset {
    return {
      path: asset.path,
      group: asset.group,
      subpath: asset.subpath,
      name: asset.name,
      mime: asset.mime,
      ext: asset.ext,
      kind: asset.kind,
      store: asset.store,
      bytes: asset.bytes,
    };
  }
  function assetGroupsForEditor(
    groups: Model.ParsedAssetGroup[],
  ): Application.EditorAssetGroup[] {
    return groups
      .map((input) => ({
        name: input.name,
        slug: input.slug,
        folder:
          input.name === runtime.UNGROUPED_ASSETS_NAME
            ? "assets/"
            : "assets/" + input.name + "/",
        tile: input.tile,
        assets: input.assets
          .filter((source): boolean => source.kind !== "font")
          .map((input2) => assetForEditor(input2)),
      }))
      .filter((input): boolean => input.assets.length > 0);
  }
  function hasOnlyManifestFile(files: Model.FileTable): boolean {
    for (let value in files) {
      if (value !== runtime.DESIGN_SYSTEM_PATHS.manifest) {
        return false;
      }
    }
    return true;
  }
  function emptyDesignSystemSections(
    view: Application.ApplicationView,
    storage: { storedBytes: number },
  ): Set<string> {
    let values = new Set<string>();
    if (view.colorGroups.every((input): boolean => input.tokens.length === 0)) {
      values.add("colors");
    }
    if (view.typeGroups.length === 0 && view.fonts.length === 0) {
      values.add("type");
    }
    if (view.spacing.tokens.length === 0) {
      values.add("spacing");
    }
    if (view.corners.tokens.length === 0) {
      values.add("corners");
    }
    if (view.shadows.tokens.length === 0) {
      values.add("shadows");
    }
    if (view.components.length === 0) {
      values.add("components");
    }
    if (view.assetGroups.length === 0 && storage.storedBytes === 0) {
      values.add("assets");
    }
    return values;
  }
  function starterSectionState(
    emptySections: ReadonlySet<string>,
    editable: boolean,
    assetsEmpty: boolean,
    hasStarter: boolean = false,
  ): { hint: boolean; starter: Set<string> } {
    if (!editable) {
      return {
        hint: false,
        starter: new Set(),
      };
    }
    let starterSections = new Set(
      STARTER_SECTION_IDS.filter((input) => emptySections.has(input)),
    );
    return {
      hint:
        !hasStarter &&
        STARTER_SECTION_IDS.every((input) =>
          input === "assets" ? assetsEmpty : emptySections.has(input),
        ),
      starter: starterSections,
    };
  }
  function designSystemEditorView(
    model: Model.ParsedDesignSystem,
  ): Application.ApplicationView {
    return {
      colorGroups: colorGroupsForEditor(model.tokens),
      typeGroups: typeGroupsForEditor(model.tokens.type.groups),
      families: fontFamiliesForEditor(model.tokens.type.families, model.fonts),
      familyNames: Object.fromEntries(
        Object.entries(model.tokens.type.families).flatMap(
          ([input, input2]) => {
            let value = firstCssFontFamily(input2);
            if (value === null) {
              return [];
            } else {
              return [[input, value]];
            }
          },
        ),
      ),
      fonts: fontFilesForEditor(model.fonts, model.assetFonts),
      spacing: tokenScaleForEditor(model.tokens.spacing),
      corners: tokenScaleForEditor(model.tokens.radius),
      shadows: shadowScaleForEditor(model.tokens),
      extras: extraTokenFamiliesForEditor(model.tokens),
      components: componentsForEditor(model.components),
      assetGroups: assetGroupsForEditor(model.assetGroups),
      readme: model.readme,
      docs: documentSectionsForEditor(model.docs),
    };
  }
  bindRuntimeValue(
    runtime,
    "optionalNonemptyText",
    () => optionalNonemptyText,
    (value) => {
      optionalNonemptyText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSETS_SECTION_LABEL",
    () => ASSETS_SECTION_LABEL,
    (value) => {
      ASSETS_SECTION_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetGroupDisplayName",
    () => assetGroupDisplayName,
    (value) => {
      assetGroupDisplayName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tokenGroupRenamePairs",
    () => tokenGroupRenamePairs,
  );
  bindRuntimeValue(runtime, "colorGroupsForEditor", () => colorGroupsForEditor);
  bindRuntimeValue(runtime, "typeGroupsForEditor", () => typeGroupsForEditor);
  bindRuntimeValue(
    runtime,
    "fontFamiliesForEditor",
    () => fontFamiliesForEditor,
  );
  bindRuntimeValue(runtime, "firstCssFontFamily", () => firstCssFontFamily);
  bindRuntimeValue(runtime, "fontFilesForEditor", () => fontFilesForEditor);
  bindRuntimeValue(runtime, "tokenScaleForEditor", () => tokenScaleForEditor);
  bindRuntimeValue(runtime, "humanizeTokenFamily", () => humanizeTokenFamily);
  bindRuntimeValue(
    runtime,
    "extraTokenFamiliesForEditor",
    () => extraTokenFamiliesForEditor,
  );
  bindRuntimeValue(
    runtime,
    "documentSectionsForEditor",
    () => documentSectionsForEditor,
  );
  bindRuntimeValue(runtime, "shadowScaleForEditor", () => shadowScaleForEditor);
  bindRuntimeValue(runtime, "componentsForEditor", () => componentsForEditor);
  bindRuntimeValue(runtime, "assetForEditor", () => assetForEditor);
  bindRuntimeValue(runtime, "assetGroupsForEditor", () => assetGroupsForEditor);
  bindRuntimeValue(runtime, "hasOnlyManifestFile", () => hasOnlyManifestFile);
  bindRuntimeValue(
    runtime,
    "extraTokenFamilySectionId",
    () => extraTokenFamilySectionId,
    (value) => {
      extraTokenFamilySectionId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyDesignSystemSections",
    () => emptyDesignSystemSections,
  );
  bindRuntimeValue(
    runtime,
    "STARTER_SECTION_IDS",
    () => STARTER_SECTION_IDS,
    (value) => {
      STARTER_SECTION_IDS = value;
    },
  );
  bindRuntimeValue(runtime, "starterSectionState", () => starterSectionState);
  bindRuntimeValue(
    runtime,
    "designSystemEditorView",
    () => designSystemEditorView,
  );
  return () => {
    optionalNonemptyText = (text: string | undefined) =>
      text === "" ? undefined : text;
    ASSETS_SECTION_LABEL = "Assets";
    assetGroupDisplayName = (group: string) =>
      group === runtime.UNGROUPED_ASSETS_NAME ? ASSETS_SECTION_LABEL : group;
    extraTokenFamilySectionId = (key: string): string => "family-" + key;
    STARTER_SECTION_IDS = [
      "colors",
      "type",
      "spacing",
      "corners",
      "shadows",
      "components",
      "assets",
    ];
  };
}
