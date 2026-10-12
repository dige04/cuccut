/** Restored application module; prepare first, initialize in original order. */
import type * as Core from "../contracts/model-core";
import type * as Model from "../contracts";
import type { UploadAssetInput } from "../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelAssetCommands(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  function mutableManifest(
    content: Model.DesignSystemContent,
  ): Core.ManifestObject & { manifestVersion: number } {
    return {
      ...(0, runtime.parseManifest)(
        content.files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
      ),
      manifestVersion: runtime.DESIGN_SYSTEM_MANIFEST_VERSION,
    };
  }
  function updateAssetGroupMetadata(
    content: Model.DesignSystemContent,
    mutate: (metadata: Model.AssetGroupMetadata) => boolean,
  ) {
    let manifest = mutableManifest(content),
      metadata = structuredClone(
        (0, runtime.parseAssetGroupMetadata)(manifest),
      );
    if (!mutate(metadata)) {
      return content;
    }
    let assetKeysByGroup = new Map<string, Set<string>>();
    for (let value of Object.keys(content.files)) {
      let value2 = parseAssetGroupPath(value);
      if (value2 === null) {
        continue;
      }
      let value3 = assetKeysByGroup.get(value2.group) ?? new Set();
      value3.add(value2.key);
      assetKeysByGroup.set(value2.group, value3);
    }
    metadata.groups = metadata.groups.filter((input) =>
      assetKeysByGroup.has(input),
    );
    for (let value of Object.keys(metadata.tiles)) {
      if (!assetKeysByGroup.has(value)) {
        delete metadata.tiles[value];
      }
    }
    for (let value of Object.keys(metadata.orders)) {
      let value2 = (
        (0, runtime.ownPropertyOrUndefined)(metadata.orders, value) ?? []
      ).filter(
        (input): boolean => assetKeysByGroup.get(value)?.has(input) === true,
      );
      if (value2.length === 0) {
        delete metadata.orders[value];
      } else {
        metadata.orders[value] = value2;
      }
    }
    let serialized = (0, runtime.serializeAssetGroupMetadata)(metadata);
    if (
      serialized.length === 0 &&
      Object.keys(manifest).every(
        (input) => input === "assetGroups" || input === "manifestVersion",
      )
    ) {
      return (0, runtime.deleteDesignSystemFiles)(content, [
        runtime.DESIGN_SYSTEM_PATHS.manifest,
      ]);
    }
    manifest.assetGroups = serialized;
    return (0, runtime.setDesignSystemFile)(
      content,
      runtime.DESIGN_SYSTEM_PATHS.manifest,
      (0, runtime.stringifyManifestWithinBudget)(manifest),
    );
  }
  function assetGroupDirectory(group: string) {
    if (group === runtime.UNGROUPED_ASSETS_NAME) {
      return runtime.DESIGN_SYSTEM_PATHS.assetsDir.slice(0, -1);
    } else {
      return runtime.DESIGN_SYSTEM_PATHS.assetsDir + group;
    }
  }
  function assetGroupFilePaths(files: Model.FileTable, group: string) {
    return Object.keys(files).filter(
      (input): boolean => parseAssetGroupPath(input)?.group === group,
    );
  }
  function parseAssetGroupPath(path: string) {
    if (!path.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
      return null;
    }
    let segments = path
      .slice(runtime.DESIGN_SYSTEM_PATHS.assetsDir.length)
      .split("/");
    if (segments.length > 1) {
      return {
        group: segments[0],
        key: segments.slice(1).join("/"),
      };
    } else {
      return {
        group: runtime.UNGROUPED_ASSETS_NAME,
        key: segments[0],
      };
    }
  }
  function addAssetFile(
    content: Model.DesignSystemContent,
    asset: UploadAssetInput,
  ) {
    let group =
      asset.group.trim() === ""
        ? runtime.UNGROUPED_ASSETS_NAME
        : asset.group.trim();
    if (
      group !== runtime.UNGROUPED_ASSETS_NAME &&
      !(0, runtime.isAssetGroupName)(group)
    ) {
      return content;
    }
    let subpathSegments = (asset.subpath ?? "")
        .split("/")
        .map((input) => input.trim())
        .filter((input) => input !== "" && input !== "." && input !== "..")
        .map(runtime.sanitizeUploadFileName),
      directory = [assetGroupDirectory(group), ...subpathSegments].join("/"),
      filename = (0, runtime.unusedFileName)(
        content.files,
        directory,
        (0, runtime.sanitizeUploadFileName)(asset.fileName),
      ),
      path: string = directory + "/" + filename;
    if (
      (0, runtime.normalizeDesignSystemPath)(path) !== path ||
      !(0, runtime.isValidDesignSystemPath)(path)
    ) {
      return content;
    }
    let next = (0, runtime.setDesignSystemFile)(content, path, asset.value);
    if (next === content) {
      return content;
    }
    if (
      asset.record !== undefined &&
      (0, runtime.parseStoragePointer)(asset.value) !== null
    ) {
      next = setFileStorageRecord(next, path, asset.record);
    }
    return next;
  }
  function renameAssetFilePath(
    content: Model.DesignSystemContent,
    oldPath: string,
    newPath: string,
  ) {
    if (!oldPath.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
      return content;
    }
    return (0, runtime.renameDesignSystemFile)(content, oldPath, newPath);
  }
  function renameAssetFile(
    content: Model.DesignSystemContent,
    path: string,
    newName: string,
  ) {
    let filename = (0, runtime.sanitizeUploadFileName)(newName),
      newPath: string =
        ((0, runtime.pathDirname)(path) === ""
          ? ""
          : (0, runtime.pathDirname)(path) + "/") + filename,
      renamed = renameAssetFilePath(content, path, newPath);
    if (renamed === content) {
      return content;
    }
    let oldGroup = parseAssetGroupPath(path),
      newGroup = parseAssetGroupPath(newPath);
    if (oldGroup === null || newGroup === null) {
      return renamed;
    }
    return updateAssetGroupMetadata(renamed, (input): boolean => {
      let value = (0, runtime.ownPropertyOrUndefined)(
          input.orders,
          oldGroup.group,
        ),
        value2 = value?.indexOf(oldGroup.key) ?? -1;
      if (value === undefined || value2 < 0) {
        return false;
      }
      value[value2] = newGroup.key;
      return true;
    });
  }
  function normalizeAssetGroupName(name: string) {
    let normalized =
      name.trim() === "" ? runtime.UNGROUPED_ASSETS_NAME : name.trim();
    if (
      normalized === runtime.UNGROUPED_ASSETS_NAME ||
      (0, runtime.isAssetGroupName)(normalized)
    ) {
      return normalized;
    } else {
      return null;
    }
  }
  function moveAssetsToGroup(
    content: Model.DesignSystemContent,
    paths: string[],
    targetGroup: string,
    beforePath?: string | null,
  ) {
    let group = normalizeAssetGroupName(targetGroup);
    if (group === null) {
      return content;
    }
    let directory = assetGroupDirectory(group),
      working = content,
      movedPaths: string[] = [];
    for (let value of paths) {
      let value2 = parseAssetGroupPath(value);
      if (
        value2 === null ||
        !Object.hasOwn(working.files, value) ||
        movedPaths.includes(value)
      ) {
        continue;
      }
      if (value2.group === group) {
        movedPaths.push(value);
        continue;
      }
      let value3: string =
          directory +
          "/" +
          (0, runtime.unusedFileName)(
            working.files,
            directory,
            (0, runtime.pathBasename)(value),
          ),
        value4 = renameAssetFilePath(working, value, value3);
      if (value4 === working) {
        continue;
      }
      working = value4;
      movedPaths.push(value3);
    }
    if (movedPaths.length === 0) {
      return content;
    }
    if (
      beforePath === undefined ||
      (beforePath !== null &&
        (movedPaths.includes(beforePath) ||
          parseAssetGroupPath(beforePath)?.group !== group))
    ) {
      return working;
    }
    let movedKeys = movedPaths.map((input) => parseAssetGroupPath(input)!.key),
      beforeKey =
        beforePath === null ? null : parseAssetGroupPath(beforePath)!.key;
    return updateAssetGroupMetadata(working, (input): boolean => {
      let value = Object.keys(working.files).flatMap((input2) => {
          let value5 = parseAssetGroupPath(input2),
            value6 = (0, runtime.assetKindForPath)(input2);
          if (value5 !== null && value5.group === group && value6 !== "font") {
            return [
              {
                key: value5.key,
                wall: (0, runtime.isWallAssetKind)(value6),
              },
            ];
          } else {
            return [];
          }
        }),
        entries = new Map(value.map((input2) => [input2.key, input2.wall])),
        value2 = (0, runtime.orderAssetTiles)(
          value,
          (
            (0, runtime.ownPropertyOrUndefined)(input.orders, group) ?? []
          ).filter((input2) => entries.has(input2)),
        ).map((input2) => input2.key),
        value3 = value2.filter(
          (input2): boolean => !movedKeys.includes(input2),
        ),
        value4 = beforeKey === null ? -1 : value3.indexOf(beforeKey);
      value3.splice(
        value4 < 0 ? value3.length : value4,
        0,
        ...movedKeys.filter((input2) => entries.has(input2)),
      );
      let items = [
        ...value3.filter((input2): boolean => entries.get(input2) === true),
        ...value3.filter((input2): boolean => entries.get(input2) !== true),
      ];
      if (
        items.length === value2.length &&
        items.every((input2, options): boolean => input2 === value2[options])
      ) {
        return false;
      }
      input.orders[group] = items;
      return true;
    });
  }
  function renameAssetGroup(
    content: Model.DesignSystemContent,
    oldName: string,
    newName: string,
  ) {
    let oldGroup = normalizeAssetGroupName(oldName),
      newGroup = newName.replace(/\s+/g, " ").trim();
    if (
      oldGroup === null ||
      !(0, runtime.isAssetGroupName)(newGroup) ||
      newGroup === runtime.UNGROUPED_ASSETS_NAME ||
      newGroup === oldGroup
    ) {
      return content;
    }
    let oldPrefix: string = assetGroupDirectory(oldGroup) + "/";
    if (
      Object.keys(content.files).some(
        (input) =>
          input.startsWith(oldPrefix) &&
          (0, runtime.protectedFilePathPredicate)(input),
      )
    ) {
      return content;
    }
    let newPrefix: string = assetGroupDirectory(newGroup) + "/",
      paths = assetGroupFilePaths(content.files, oldGroup);
    if (
      paths.length === 0 ||
      Object.keys(content.files).some((input) => input.startsWith(newPrefix))
    ) {
      return content;
    }
    let working = content;
    for (let value of paths) {
      let value2 = (0, runtime.renameDesignSystemFile)(
        working,
        value,
        newPrefix +
          value.slice(
            oldGroup === runtime.UNGROUPED_ASSETS_NAME
              ? runtime.DESIGN_SYSTEM_PATHS.assetsDir.length
              : oldPrefix.length,
          ),
      );
      if (value2 === working) {
        return content;
      }
      working = value2;
    }
    working = updateAssetGroupMetadata(working, (input): boolean => {
      input.groups = input.groups.map((input2) =>
        input2 === oldGroup ? newGroup : input2,
      );
      let value = (0, runtime.ownPropertyOrUndefined)(input.tiles, oldGroup),
        value2 = (0, runtime.ownPropertyOrUndefined)(input.orders, oldGroup);
      delete input.tiles[oldGroup];
      delete input.orders[oldGroup];
      if (value !== undefined) {
        input.tiles[newGroup] = value;
      }
      if (value2 !== undefined) {
        input.orders[newGroup] = value2;
      }
      return true;
    });
    return setSectionTitle(working, "assets:" + oldGroup, "");
  }
  function deleteAssetFile(content: Model.DesignSystemContent, path: string) {
    return deleteAssetFiles(content, [path]);
  }
  function deleteAssetFiles(
    content: Model.DesignSystemContent,
    paths: string[],
  ) {
    return (0, runtime.deleteDesignSystemFiles)(
      content,
      paths.filter((input): boolean => parseAssetGroupPath(input) !== null),
    );
  }
  function setFileStorageRecord(
    content: Model.DesignSystemContent,
    path: string,
    record: Model.StorageRecord,
  ) {
    let value = content.files[path];
    if (value === undefined) {
      return content;
    }
    let pointer = (0, runtime.storagePointerForFile)(path, value);
    if (
      pointer === null ||
      pointer.store !== record.store ||
      (pointer.store === "blob" && record.id !== pointer.id)
    ) {
      return content;
    }
    let manifest = mutableManifest(content),
      catalog = (0, runtime.storageCatalogFromManifest)(manifest);
    catalog.files[path] = record;
    manifest.storage = (0, runtime.serializeStorageCatalog)(catalog);
    return (0, runtime.setDesignSystemFile)(
      content,
      runtime.DESIGN_SYSTEM_PATHS.manifest,
      (0, runtime.stringifyManifestWithinBudget)(manifest),
    );
  }
  function updateStorageCatalog(
    content: Model.DesignSystemContent,
    mutate: (catalog: Model.StorageCatalog) => Model.StorageCatalog | null,
  ) {
    let manifest = mutableManifest(content),
      catalog = mutate((0, runtime.storageCatalogFromManifest)(manifest));
    if (catalog === null) {
      return content;
    }
    let serialized = (0, runtime.serializeStorageCatalog)(catalog);
    if (serialized === undefined) {
      delete manifest.storage;
    } else {
      manifest.storage = serialized;
    }
    return (0, runtime.setDesignSystemFile)(
      content,
      runtime.DESIGN_SYSTEM_PATHS.manifest,
      (0, runtime.stringifyManifestWithinBudget)(manifest),
    );
  }
  function replaceInlineFileWithPointer(
    content: Model.DesignSystemContent,
    path: string,
    expectedValue: string,
    pointer: string,
    record: Model.StorageRecord,
  ) {
    if (
      content.files[path] !== expectedValue ||
      (0, runtime.parseStoragePointer)(pointer) === null
    ) {
      return content;
    }
    let next = (0, runtime.setDesignSystemFile)(content, path, pointer);
    if (next === content) {
      return content;
    } else {
      return setFileStorageRecord(next, path, record);
    }
  }
  function removeMissingStorageDigests(
    content: Model.DesignSystemContent,
    missingIds: ReadonlySet<string>,
  ) {
    if (missingIds.size === 0) {
      return content;
    }
    return updateStorageCatalog(content, (input) => {
      let value: Model.StorageCatalog = (0, runtime.dropMissingBlobDigests)(input, missingIds);
      if (value === input) {
        return null;
      } else {
        return value;
      }
    });
  }
  function setLastChange(
    content: Model.DesignSystemContent,
    change: Core.LastChangeDraft,
  ) {
    let normalized = (0, runtime.parseLastChange)({
      ...(change.extra ?? {}),
      by: change.by,
      ...(change.via !== undefined
        ? {
            via: change.via,
          }
        : {}),
      at: change.at,
      ...(change.note !== undefined
        ? {
            note: change.note,
          }
        : {}),
    }).value;
    if (normalized === null) {
      return content;
    }
    let manifest = mutableManifest(content);
    manifest.lastChange = (0, runtime.serializeLastChange)(normalized);
    return (0, runtime.setDesignSystemFile)(
      content,
      runtime.DESIGN_SYSTEM_PATHS.manifest,
      (0, runtime.stringifyManifestWithinBudget)(manifest),
    );
  }
  function refreshManifest(content: Model.DesignSystemContent, title: string) {
    let manifestText = (0, runtime.serializeDesignSystemManifest)(
      (0, runtime.buildDesignSystemManifest)(
        (0, runtime.parsedDesignSystem)(content),
        title,
      ),
    );
    if (content.files[runtime.DESIGN_SYSTEM_PATHS.manifest] === manifestText) {
      return content;
    }
    return (0, runtime.setDesignSystemFile)(
      content,
      runtime.DESIGN_SYSTEM_PATHS.manifest,
      manifestText,
    );
  }
  function finalizeContentChange(
    previous: Model.DesignSystemContent,
    next: Model.DesignSystemContent,
    title: string,
  ) {
    if (next === previous) {
      return previous;
    }
    return refreshManifest(next, title);
  }
  function setSectionTitle(
    content: Model.DesignSystemContent,
    key: string,
    title: string,
  ) {
    let normalized = (0, runtime.normalizeSectionTitleModelManifestMetadata)(
        title,
      ),
      manifest = mutableManifest(content),
      sections = {
        ...(0, runtime.sectionTitlesFromManifest)(manifest),
      };
    if ((sections[key] ?? "") === normalized) {
      return content;
    }
    if (normalized === "") {
      delete sections[key];
    } else {
      sections[key] = normalized;
    }
    let serialized = (0, runtime.serializeSectionTitles)(sections);
    if (serialized === undefined) {
      delete manifest.sections;
    } else {
      manifest.sections = serialized;
    }
    return (0, runtime.setDesignSystemFile)(
      content,
      runtime.DESIGN_SYSTEM_PATHS.manifest,
      (0, runtime.stringifyManifestWithinBudget)(manifest),
    );
  }
  function unusedTokenName(
    tokens: Model.NormalizedTokens,
    family: Core.TokenKind,
    preferredName: string,
  ) {
    let taken = new Set((0, runtime.conflictingTokenNames)(tokens, family)),
      base = (0, runtime.normalizeTokenName)(preferredName) || "token";
    if (!taken.has(base)) {
      return base;
    }
    let numericSuffix = /^(.*-)(\d{1,4})$/.exec(base);
    if (numericSuffix !== null) {
      let length = numericSuffix[2].length;
      for (
        let value = parseInt(numericSuffix[2], 10) + 1;
        value < 1e4;
        value++
      ) {
        let value2 = numericSuffix[1] + String(value).padStart(length, "0");
        if (!taken.has(value2)) {
          return value2;
        }
      }
    }
    for (let count: number = 2; count < 1e4; count++) {
      if (!taken.has(base + "-" + String(count))) {
        return base + "-" + String(count);
      }
    }
    return base + "-" + String(Date.now());
  }
  function addColorToken(
    content: Model.DesignSystemContent,
    name: string,
    value: unknown,
    afterName?: string,
  ) {
    let normalized = (0, runtime.normalizeColorOrAlias)(value);
    if (!runtime.TOKEN_NAME_PATTERN.test(name) || normalized === undefined) {
      return content;
    }
    return (0, runtime.updateTokens)(content, (input): boolean => {
      if (
        (0, runtime.conflictingTokenNames)(input, "color").includes(name) ||
        input.color.tokens.length >= runtime.MAX_COLOR_TOKENS
      ) {
        return false;
      }
      if (input.color.themes.length === 0) {
        input.color.themes.push({
          id: "light",
          name: "Light",
        });
      }
      let state = {
          name: name,
          value: {
            [input.color.themes[0]?.id ?? "light"]: normalized,
          },
          usage: "",
        },
        value2 =
          afterName !== undefined
            ? input.color.tokens.findIndex(
                (input2): boolean => input2.name === afterName,
              )
            : -1;
      if (value2 >= 0) {
        input.color.tokens.splice(value2 + 1, 0, state);
      } else {
        input.color.tokens.push(state);
      }
      return true;
    });
  }
  function addScalarToken(
    content: Model.DesignSystemContent,
    family: Core.ScalarKind,
    name: string,
    value: unknown,
    afterName?: string,
    extraFamily?: string,
  ) {
    let normalized = (0, runtime.normalizeScalarTokenValue)(family, value);
    if (!runtime.TOKEN_NAME_PATTERN.test(name) || normalized === undefined) {
      return content;
    }
    return (0, runtime.updateTokens)(content, (input): boolean => {
      let value2 =
        family === "extra"
          ? input.extra.find((input2): boolean => input2.key === extraFamily)
              ?.tokens
          : input[family].tokens;
      if (
        value2 === undefined ||
        (0, runtime.conflictingTokenNames)(input, family).includes(name) ||
        value2.length >= runtime.MAX_TOKENS_PER_FAMILY
      ) {
        return false;
      }
      let state = {
          name: name,
          value: normalized,
          usage: "",
        },
        value3 =
          afterName !== undefined
            ? value2.findIndex((input2): boolean => input2.name === afterName)
            : -1;
      if (value3 >= 0) {
        value2.splice(value3 + 1, 0, state);
      } else {
        value2.push(state);
      }
      return true;
    });
  }
  function addShadowToken(
    content: Model.DesignSystemContent,
    name: string,
    value: unknown,
  ) {
    let normalized = (0, runtime.normalizeBoxShadow)(value);
    if (!runtime.TOKEN_NAME_PATTERN.test(name) || normalized === undefined) {
      return content;
    }
    return (0, runtime.updateTokens)(content, (input): boolean => {
      if (
        (0, runtime.conflictingTokenNames)(input, "shadow").includes(name) ||
        input.shadow.tokens.length >= runtime.MAX_TOKENS_PER_FAMILY
      ) {
        return false;
      }
      if (input.color.themes.length === 0) {
        input.color.themes.push({
          id: "light",
          name: "Light",
        });
      }
      let state = {
        name: name,
        value: {
          [input.color.themes[0]?.id ?? "light"]: normalized,
        },
        usage: "",
      };
      input.shadow.tokens.push(state);
      return true;
    });
  }
  function addTypographyStyle(
    content: Model.DesignSystemContent,
    name: string,
    afterName?: string,
    groupName?: string,
  ) {
    if (!runtime.TOKEN_NAME_PATTERN.test(name)) {
      return content;
    }
    return (0, runtime.updateTokens)(content, (input): boolean => {
      let value = input.type.groups.flatMap((input2) => input2.styles);
      if (
        value.some((input2): boolean => input2.name === name) ||
        value.length >= runtime.MAX_TYPOGRAPHY_STYLES
      ) {
        return false;
      }
      let value2 =
          groupName !== undefined
            ? input.type.groups.find(
                (input2): boolean => input2.name === groupName,
              )
            : input.type.groups[0],
        value3 = -1,
        value4: Model.TypographyStyle | undefined;
      if (afterName !== undefined) {
        for (let value6 of input.type.groups) {
          let value7 = value6.styles.findIndex(
            (input2): boolean => input2.name === afterName,
          );
          if (value7 >= 0) {
            value2 = value6;
            value3 = value7;
            value4 = value6.styles[value7];
            break;
          }
        }
      }
      if (value2 === undefined) {
        value2 = {
          name: "Styles",
          family: Object.keys(input.type.families)[0] ?? "",
          note: "",
          styles: [],
        };
        input.type.groups.push(value2);
      }
      let value5: Model.TypographyStyle =
        value4 !== undefined
          ? {
              ...value4,
              name: name,
              sample: "",
              usage: "",
            }
          : {
              name: name,
              fontSize: "16px",
              lineHeight: "1.5",
              fontWeight: "400",
              letterSpacing: "0",
              fontStyle: "normal",
              opticalSize: null,
              family: "",
              sample: "",
              usage: "",
            };
      if (value3 >= 0) {
        value2.styles.splice(value3 + 1, 0, value5);
      } else {
        value2.styles.push(value5);
      }
      return true;
    });
  }
  function addTypographyGroup(
    content: Model.DesignSystemContent,
    preferredName: string,
  ) {
    return (0, runtime.updateTokens)(content, (input): boolean => {
      if (input.type.groups.length >= runtime.MAX_TYPOGRAPHY_GROUPS) {
        return false;
      }
      let values = new Set(input.type.groups.map((input2) => input2.name)),
        value = preferredName;
      for (let count: number = 2; values.has(value); count++) {
        value = preferredName + " " + String(count);
      }
      input.type.groups.push({
        name: value,
        family: Object.keys(input.type.families)[0] ?? "",
        note: "",
        styles: [],
      });
      return true;
    });
  }
  function renameTypographyGroup(
    content: Model.DesignSystemContent,
    oldName: string,
    newName: string,
  ) {
    let normalized = newName
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, runtime.MAX_TOKEN_LABEL_LENGTH);
    if (normalized === "" || normalized === oldName) {
      return content;
    }
    return (0, runtime.updateTokens)(content, (input): boolean => {
      if (
        input.type.groups.some((input2): boolean => input2.name === normalized)
      ) {
        return false;
      }
      let value = input.type.groups.find(
        (input2): boolean => input2.name === oldName,
      );
      if (value === undefined) {
        return false;
      }
      value.name = normalized;
      return true;
    });
  }
  function deleteTypographyGroup(
    content: Model.DesignSystemContent,
    name: string,
  ) {
    return (0, runtime.updateTokens)(content, (input): boolean => {
      let length = input.type.groups.length;
      input.type.groups = input.type.groups.filter(
        (input2): boolean => input2.name !== name,
      );
      if (input.type.groups.length === length) {
        return false;
      }
      (0, runtime.pruneUnusedFontFamilies)(input);
      return true;
    });
  }
  bindRuntimeValue(runtime, "mutableManifest", () => mutableManifest);
  bindRuntimeValue(
    runtime,
    "updateAssetGroupMetadata",
    () => updateAssetGroupMetadata,
  );
  bindRuntimeValue(runtime, "assetGroupDirectory", () => assetGroupDirectory);
  bindRuntimeValue(runtime, "assetGroupFilePaths", () => assetGroupFilePaths);
  bindRuntimeValue(runtime, "parseAssetGroupPath", () => parseAssetGroupPath);
  bindRuntimeValue(runtime, "addAssetFile", () => addAssetFile);
  bindRuntimeValue(runtime, "renameAssetFilePath", () => renameAssetFilePath);
  bindRuntimeValue(runtime, "renameAssetFile", () => renameAssetFile);
  bindRuntimeValue(
    runtime,
    "normalizeAssetGroupName",
    () => normalizeAssetGroupName,
  );
  bindRuntimeValue(runtime, "moveAssetsToGroup", () => moveAssetsToGroup);
  bindRuntimeValue(runtime, "renameAssetGroup", () => renameAssetGroup);
  bindRuntimeValue(runtime, "deleteAssetFile", () => deleteAssetFile);
  bindRuntimeValue(runtime, "deleteAssetFiles", () => deleteAssetFiles);
  bindRuntimeValue(runtime, "setFileStorageRecord", () => setFileStorageRecord);
  bindRuntimeValue(runtime, "updateStorageCatalog", () => updateStorageCatalog);
  bindRuntimeValue(
    runtime,
    "replaceInlineFileWithPointer",
    () => replaceInlineFileWithPointer,
  );
  bindRuntimeValue(
    runtime,
    "removeMissingStorageDigests",
    () => removeMissingStorageDigests,
  );
  bindRuntimeValue(runtime, "setLastChange", () => setLastChange);
  bindRuntimeValue(runtime, "refreshManifest", () => refreshManifest);
  bindRuntimeValue(
    runtime,
    "finalizeContentChange",
    () => finalizeContentChange,
  );
  bindRuntimeValue(runtime, "setSectionTitle", () => setSectionTitle);
  bindRuntimeValue(runtime, "unusedTokenName", () => unusedTokenName);
  bindRuntimeValue(runtime, "addColorToken", () => addColorToken);
  bindRuntimeValue(runtime, "addScalarToken", () => addScalarToken);
  bindRuntimeValue(runtime, "addShadowToken", () => addShadowToken);
  bindRuntimeValue(runtime, "addTypographyStyle", () => addTypographyStyle);
  bindRuntimeValue(runtime, "addTypographyGroup", () => addTypographyGroup);
  bindRuntimeValue(
    runtime,
    "renameTypographyGroup",
    () => renameTypographyGroup,
  );
  bindRuntimeValue(
    runtime,
    "deleteTypographyGroup",
    () => deleteTypographyGroup,
  );
  return () => {};
}
