/** Restored application module; prepare first, initialize in original order. */
import type * as Core from "../contracts/model-core";
import type * as Model from "../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type { AssetGroupMetadata, ParseReport } from "../contracts";
export function installModelManifestMetadata(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var isManifestMetadataObject: (
    input: unknown,
  ) => input is Record<string, unknown>;
  var MAX_MANIFEST_LIBRARIES: number;
  var MAX_BUNDLE_HEADER_COMPONENTS: number;
  var MAX_MANIFEST_ASSET_GROUPS: number;
  var MAX_ASSET_GROUP_NAME_LENGTH: number;
  var ASSET_TILE_SIZES: string[];
  var DEFAULT_ASSET_TILE_SIZE: Model.AssetTileSize;
  var SECTION_TITLE_KEY_PATTERN: RegExp;
  var isDesignSystemContentObject: (
    input: unknown,
  ) => input is Record<string, unknown>;
  function parseManifestLibraries(
    input: unknown,
    sourceLabel: string,
    report: ParseReport,
  ) {
    let libraries: Model.DeclaredLibrary[] = [];
    if (!Array.isArray(input)) {
      return libraries;
    }
    let seenNames = new Set<string>();
    for (let value of input as unknown[]) {
      if (libraries.length >= MAX_MANIFEST_LIBRARIES) {
        break;
      }
      let text = "",
        text2 = "",
        value2: string | undefined,
        value3: string | undefined;
      if (typeof value === "string") {
        let value4 = value.lastIndexOf("@");
        text = (value4 > 0 ? value.slice(0, value4) : value)
          .trim()
          .toLowerCase();
        text2 = value4 > 0 ? value.slice(value4 + 1).trim() : "";
      } else if (isManifestMetadataObject(value)) {
        text =
          typeof value.name === "string" ? value.name.trim().toLowerCase() : "";
        text2 =
          typeof value.version === "string"
            ? value.version.trim()
            : typeof value.version === "number"
              ? String(value.version)
              : "";
        if (typeof value.global === "string") {
          if (runtime.WINDOW_NAMESPACE_PATTERN.test(value.global.trim())) {
            value2 = value.global.trim();
          } else {
            report.warnings.push(
              sourceLabel +
                " library " +
                JSON.stringify(text) +
                ': "global" is not a JS identifier — ignored',
            );
          }
        }
        if (typeof value.file === "string") {
          let value4 = (0, runtime.isValidDesignSystemPath)(value.file.trim())
            ? (0, runtime.normalizeDesignSystemPath)(value.file.trim())
            : "";
          if (
            runtime.PACKAGED_LIBRARY_PATH_PATTERN.test(value4) &&
            (0, runtime.isValidDesignSystemPath)(value4)
          ) {
            value3 = value4;
          } else {
            report.warnings.push(
              sourceLabel +
                " library " +
                JSON.stringify(text) +
                ': "file" must be one .js under components/lib/ — ignored',
            );
          }
        }
      }
      text2 = text2.replace(/^[\^~=v]/, "");
      if (
        !runtime.LIBRARY_NAME_PATTERN.test(text) ||
        !runtime.LIBRARY_VERSION_PATTERN.test(text2)
      ) {
        report.dropped.push(
          sourceLabel +
            " library " +
            JSON.stringify(text + "@" + text2) +
            ": bad name or version",
        );
        continue;
      }
      if (seenNames.has(text)) {
        report.warnings.push(
          sourceLabel + " library " + text + ": listed twice — first wins",
        );
        continue;
      }
      seenNames.add(text);
      libraries.push({
        name: text,
        version: text2,
        ...(value2 !== undefined
          ? {
              global: value2,
            }
          : {}),
        ...(value3 !== undefined
          ? {
              file: value3,
            }
          : {}),
      });
    }
    return libraries;
  }
  function parseManifestBundleMetadata(
    manifestInput: unknown,
    report: ParseReport = { dropped: [], warnings: [] },
  ) {
    let manifest = (0, runtime.parseManifest)(manifestInput, report),
      namespace =
        typeof manifest.namespace === "string"
          ? manifest.namespace.trim()
          : null;
    if (
      namespace !== null &&
      !runtime.WINDOW_NAMESPACE_PATTERN.test(namespace)
    ) {
      report.warnings.push(
        "manifest.json namespace " +
          JSON.stringify(namespace.slice(0, 40)) +
          ": not a JS identifier — ignored",
      );
      namespace = null;
    }
    let libraries = Array.isArray(manifest.libraries)
      ? parseManifestLibraries(manifest.libraries, "manifest.json", report)
      : [];
    return {
      namespace: namespace,
      libraries: libraries.length > 0 ? libraries : null,
    };
  }
  function isAssetTileSize(value: unknown): value is Model.AssetTileSize {
    return typeof value === "string" && ASSET_TILE_SIZES.includes(value);
  }
  function isAssetOrderKey(key: unknown): key is string {
    if (typeof key !== "string" || key === "" || key.length > 400) {
      return false;
    }
    let path: string = "assets/g/" + key;
    return (
      (0, runtime.isValidDesignSystemPath)(path) &&
      (0, runtime.normalizeDesignSystemPath)(path) === path
    );
  }
  function ownPropertyOrUndefined<Value>(
    object: Record<string, Value>,
    key: string,
  ) {
    if (Object.hasOwn(object, key)) {
      return object[key];
    } else {
      return undefined;
    }
  }
  function isAssetGroupName(name: unknown): name is string {
    return (
      typeof name === "string" &&
      name.length > 0 &&
      name.length <= MAX_ASSET_GROUP_NAME_LENGTH &&
      !/[/\\\u0000-\u001f\u007f]/.test(name) &&
      name !== "." &&
      name !== ".." &&
      !runtime.RESERVED_PROTOTYPE_NAMES.has(name) &&
      name.trim() === name
    );
  }
  function parseAssetGroupMetadata(
    manifestInput: unknown,
    report: ParseReport = {
      dropped: [],
      warnings: [],
    },
  ): AssetGroupMetadata {
    let manifest = (0, runtime.parseManifest)(manifestInput, report),
      groups: string[] = [],
      tiles: Record<string, Model.AssetTileSize> = {},
      orders: Record<string, string[]> = {};
    if (
      Object.hasOwn(manifest, "assetGroups") &&
      !Array.isArray(manifest.assetGroups)
    ) {
      report.dropped.push(
        "manifest.json assetGroups: not an array — group order ignored",
      );
    }
    if (Array.isArray(manifest.assetGroups)) {
      for (let value of manifest.assetGroups as unknown[]) {
        if (!isManifestMetadataObject(value)) {
          continue;
        }
        if (
          groups.length < MAX_MANIFEST_ASSET_GROUPS &&
          isAssetGroupName(value.name) &&
          !groups.includes(value.name)
        ) {
          groups.push(value.name);
        }
        if (
          isAssetGroupName(value.name) &&
          isAssetTileSize(value.tile) &&
          value.tile !== DEFAULT_ASSET_TILE_SIZE &&
          !Object.hasOwn(tiles, value.name)
        ) {
          tiles[value.name] = value.tile;
        }
        if (
          isAssetGroupName(value.name) &&
          Array.isArray(value.order) &&
          !Object.hasOwn(orders, value.name)
        ) {
          let value2 = [...new Set(value.order.filter(isAssetOrderKey))].slice(
            0,
            runtime.MAX_DESIGN_SYSTEM_FILES,
          );
          if (value2.length > 0) {
            orders[value.name] = value2;
          }
        }
      }
    }
    return {
      groups: groups,
      tiles: tiles,
      orders: orders,
    };
  }
  function serializeAssetGroupMetadata(metadata: AssetGroupMetadata) {
    let names = [...metadata.groups];
    for (let value of [
      ...Object.keys(metadata.tiles),
      ...Object.keys(metadata.orders),
    ]) {
      if (!names.includes(value)) {
        names.push(value);
      }
    }
    return names.map((input) => {
      let value = ownPropertyOrUndefined(metadata.tiles, input),
        value2 = ownPropertyOrUndefined(metadata.orders, input);
      return {
        name: input,
        ...(value !== undefined && value !== DEFAULT_ASSET_TILE_SIZE
          ? {
              tile: value,
            }
          : {}),
        ...(value2 !== undefined && value2.length > 0
          ? {
              order: value2,
            }
          : {}),
      };
    });
  }
  function parseBundleHeader(script: string) {
    let prefix = script.slice(0, 262144),
      headerOffset = prefix.indexOf("@ds-bundle:");
    if (headerOffset < 0) {
      return null;
    }
    let commentStart = prefix.lastIndexOf("/*", headerOffset),
      commentEnd = prefix.indexOf("*/", headerOffset);
    if (commentStart < 0 || commentEnd < 0) {
      return null;
    }
    if (prefix.slice(0, commentStart).trim() !== "") {
      return null;
    }
    let json = prefix.slice(headerOffset + 11, commentEnd).trim(),
      header: unknown;
    try {
      header = JSON.parse(json);
    } catch {
      return null;
    }
    if (!isManifestMetadataObject(header)) {
      return null;
    }
    let components: string[] = [];
    if (Array.isArray(header.components)) {
      for (let value of header.components as unknown[]) {
        let value2 =
          typeof value === "string"
            ? value
            : isManifestMetadataObject(value) && typeof value.name === "string"
              ? value.name
              : "";
        if (
          runtime.COMPONENT_NAME_PATTERN.test(value2) &&
          !components.includes(value2) &&
          components.length < MAX_BUNDLE_HEADER_COMPONENTS
        ) {
          components.push(value2);
        }
      }
    }
    let inlinedExternals: string[] = [];
    if (Array.isArray(header.inlinedExternals)) {
      for (let value of header.inlinedExternals as unknown[]) {
        if (
          typeof value === "string" &&
          value.length <= 60 &&
          inlinedExternals.length < 40
        ) {
          inlinedExternals.push(value);
        }
      }
    }
    return {
      format: typeof header.format === "number" ? header.format : null,
      namespace:
        typeof header.namespace === "string" &&
        runtime.WINDOW_NAMESPACE_PATTERN.test(header.namespace)
          ? header.namespace
          : null,
      components: components,
      inlinedExternals: inlinedExternals,
    };
  }
  function normalizeSectionTitleModelManifestMetadata(title: string) {
    return title
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, runtime.MAX_TOKEN_LABEL_LENGTH);
  }
  function sectionTitlesFromManifest(
    manifestInput: string | Core.ManifestObject,
  ) {
    let manifest: Core.ManifestObject = {};
    if (typeof manifestInput === "string") {
      try {
        let value: unknown = JSON.parse(
          manifestInput === "" ? "{}" : manifestInput,
        );
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          manifest = value as Core.ManifestObject;
        }
      } catch {
        return {};
      }
    } else {
      manifest = manifestInput;
    }
    let sections = manifest.sections;
    if (
      typeof sections !== "object" ||
      sections === null ||
      Array.isArray(sections)
    ) {
      return {};
    }
    let titles: Record<string, string> = {};
    for (let value of Object.keys(sections).sort()) {
      let value2 = (sections as Record<string, unknown>)[value];
      if (
        !SECTION_TITLE_KEY_PATTERN.test(value) ||
        typeof value2 !== "string"
      ) {
        continue;
      }
      let value3 = normalizeSectionTitleModelManifestMetadata(value2);
      if (value3 !== "") {
        titles[value] = value3;
      }
    }
    return Object.freeze(titles);
  }
  function serializeSectionTitles(titles: Readonly<Record<string, string>>) {
    let keys = Object.keys(titles).sort();
    if (keys.length === 0) {
      return;
    }
    let result: Record<string, string> = {};
    for (let value of keys) {
      result[value] = titles[value];
    }
    return result;
  }
  bindRuntimeValue(
    runtime,
    "isManifestMetadataObject",
    () => isManifestMetadataObject,
    (value) => {
      isManifestMetadataObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_MANIFEST_LIBRARIES",
    () => MAX_MANIFEST_LIBRARIES,
    (value) => {
      MAX_MANIFEST_LIBRARIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_BUNDLE_HEADER_COMPONENTS",
    () => MAX_BUNDLE_HEADER_COMPONENTS,
    (value) => {
      MAX_BUNDLE_HEADER_COMPONENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseManifestLibraries",
    () => parseManifestLibraries,
  );
  bindRuntimeValue(
    runtime,
    "parseManifestBundleMetadata",
    () => parseManifestBundleMetadata,
  );
  bindRuntimeValue(
    runtime,
    "MAX_MANIFEST_ASSET_GROUPS",
    () => MAX_MANIFEST_ASSET_GROUPS,
    (value) => {
      MAX_MANIFEST_ASSET_GROUPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_ASSET_GROUP_NAME_LENGTH",
    () => MAX_ASSET_GROUP_NAME_LENGTH,
    (value) => {
      MAX_ASSET_GROUP_NAME_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_TILE_SIZES",
    () => ASSET_TILE_SIZES,
    (value) => {
      ASSET_TILE_SIZES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_ASSET_TILE_SIZE",
    () => DEFAULT_ASSET_TILE_SIZE,
    (value) => {
      DEFAULT_ASSET_TILE_SIZE = value;
    },
  );
  bindRuntimeValue(runtime, "isAssetTileSize", () => isAssetTileSize);
  bindRuntimeValue(runtime, "isAssetOrderKey", () => isAssetOrderKey);
  bindRuntimeValue(
    runtime,
    "ownPropertyOrUndefined",
    () => ownPropertyOrUndefined,
  );
  bindRuntimeValue(runtime, "isAssetGroupName", () => isAssetGroupName);
  bindRuntimeValue(
    runtime,
    "parseAssetGroupMetadata",
    () => parseAssetGroupMetadata,
  );
  bindRuntimeValue(
    runtime,
    "serializeAssetGroupMetadata",
    () => serializeAssetGroupMetadata,
  );
  bindRuntimeValue(runtime, "parseBundleHeader", () => parseBundleHeader);
  bindRuntimeValue(
    runtime,
    "SECTION_TITLE_KEY_PATTERN",
    () => SECTION_TITLE_KEY_PATTERN,
    (value) => {
      SECTION_TITLE_KEY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeSectionTitleModelManifestMetadata",
    () => normalizeSectionTitleModelManifestMetadata,
  );
  bindRuntimeValue(
    runtime,
    "sectionTitlesFromManifest",
    () => sectionTitlesFromManifest,
  );
  bindRuntimeValue(
    runtime,
    "serializeSectionTitles",
    () => serializeSectionTitles,
  );
  bindRuntimeValue(
    runtime,
    "isDesignSystemContentObject",
    () => isDesignSystemContentObject,
    (value) => {
      isDesignSystemContentObject = value;
    },
  );
  return () => {
    isManifestMetadataObject = (
      input: unknown,
    ): input is Record<string, unknown> =>
      typeof input === "object" && input !== null && !Array.isArray(input);
    MAX_MANIFEST_LIBRARIES = 12;
    MAX_BUNDLE_HEADER_COMPONENTS = 300;
    MAX_MANIFEST_ASSET_GROUPS = 60;
    MAX_ASSET_GROUP_NAME_LENGTH = 80;
    ASSET_TILE_SIZES = ["xs", "s", "m", "l", "xl"];
    DEFAULT_ASSET_TILE_SIZE = "m";
    SECTION_TITLE_KEY_PATTERN = /^\S[^\x00-\x1f]{0,80}$/;
    isDesignSystemContentObject = (
      input: unknown,
    ): input is Record<string, unknown> =>
      typeof input === "object" && input !== null && !Array.isArray(input);
  };
}
