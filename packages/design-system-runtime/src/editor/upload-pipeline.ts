import type * as Storage from "../contracts/model-storage";
import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorUploadPipeline(
  runtime: RuntimeBindings,
): () => void {
  var UNSUPPORTED_UPLOAD_KIND_MESSAGE: string;
  var UPLOAD_REASON_MESSAGES: Record<string, string>;
  var countedFileLabel: (count: number) => string;
  var ADDED_FILES_PREFIX: string;
  var MAX_UPLOAD_SUMMARY_ITEMS: number;
  var MAX_UPLOAD_ERROR_DETAILS: number;
  function uploadedAssetFile(file: File): Model.UploadedAssetFile {
    return {
      file: file,
      kind: (0, runtime.assetFileExtension)(file.name, file.type),
      name: (0, runtime.sanitizeUploadFileName)(uploadFileBaseName(file.name)),
    };
  }
  function createUploadBatchState(): Model.AssetUploadBatchState {
    return {
      rateLimited: false,
    };
  }
  function resolveAssetUploadRoute(
    options: Editor.AssetFileUploadOptions,
    file: Editor.AssetUploadApi | null,
  ): Editor.AssetUploadRoute {
    let value = options.catalogue?.() ?? runtime.EMPTY_STORAGE_CATALOG,
      value2 = (0, runtime.getAssetsCatalogState)(),
      value3 =
        value2.state === "listed"
          ? value2.usage.bytes
          : (0, runtime.uniqueStoredBlobBytes)(value),
      value4 =
        value2.state === "listed"
          ? value2.usage.files
          : (0, runtime.uniqueStoredBlobCount)(value),
      value5 =
        value2.state === "listed"
          ? {
              blobMaxBytes: value2.usage.maxBytes,
              blobMaxFiles: value2.usage.maxFiles,
            }
          : {};
    return {
      room: options.room?.() ?? Number.POSITIVE_INFINITY,
      tier: file === null ? "off" : (0, runtime.getAssetsTierState)().state,
      blobUsed: value3,
      blobCount: value4,
      ...value5,
      cat: value,
    };
  }
  function resolveAssetStorageApi(
    options: Editor.AssetFileUploadOptions,
  ): Promise<Editor.AssetUploadApi | null> {
    if (options.api === undefined) {
      return (0,
      runtime.resolveAssetsCapability)() as Promise<Editor.AssetUploadApi | null>;
    } else {
      return Promise.resolve(options.api);
    }
  }
  function readUploadedFileValue(
    file: Model.UploadedAssetFile,
    bytes: Uint8Array,
  ): Editor.UploadedFileValue {
    if ((0, runtime.isTextFilePath)(file.name)) {
      try {
        return {
          value: new TextDecoder("utf-8", {
            fatal: true,
          }).decode(bytes),
        };
      } catch {
        return {
          reason: "not valid UTF-8 text",
        };
      }
    }
    let value =
      file.kind !== null
        ? runtime.ASSET_EXTENSION_MIME_TYPES[file.kind]
        : file.file.type !== ""
          ? file.file.type
          : "application/octet-stream";
    return {
      value: (0, runtime.bytesToFileDataUrl)(value, bytes),
    };
  }
  function deduplicatedUploadedAsset(
    file: Model.StorageCatalog,
    bytes: string,
    existingIds: ReadonlySet<string>,
  ): Editor.UploadedBlob | null {
    let catalogue = (0, runtime.listedAssetIds)(),
      existing = (0, runtime.findStoredBlobByDigest)(file, bytes, catalogue);
    if (existing !== null && !existingIds.has(existing.id)) {
      return {
        ...existing,
        sha256: bytes,
      };
    }
    if (catalogue === null) {
      return null;
    }
    let value = (0, runtime.getRecentOrphanedAssets)().find(
      (input: Storage.OrphanedAsset & { sha256?: string }) =>
        input.sha256 === bytes &&
        catalogue.has(input.id) &&
        !existingIds.has(input.id),
    );
    if (value !== undefined) {
      return {
        id: value.id,
        bytes: value.bytes,
        type: "",
        sha256: bytes,
      };
    } else {
      return null;
    }
  }
  function commitUploadedAsset(
    uploaded: Model.UploadedAssetFile,
    result: Editor.UploadedBlob,
    mimeType: string,
    options: Editor.AssetFileUploadOptions,
  ): Editor.FileUploadResult {
    let now = options.now ?? (() => new Date().toISOString()),
      record: Model.AssetUploadRecord = {
        store: "blob",
        id: result.id,
        sha256: result.sha256,
        bytes: result.bytes > 0 ? result.bytes : uploaded.file.size,
        type: result.type !== "" ? result.type : mimeType,
        name: uploaded.file.name.slice(0, 200),
        addedAt: now(),
        via: "page",
        ...(result.url !== undefined
          ? {
              url: result.url,
            }
          : {}),
      };
    return {
      ok: true,
      fileName: uploaded.name,
      value: (0, runtime.blobPointer)(result.id),
      tier: "blob",
      record: record,
      deduped: true,
    };
  }
  async function uploadAssetFile(
    uploaded: Model.UploadedAssetFile,
    fontUpload: boolean,
    options: Editor.AssetFileUploadOptions = {},
    progress: Editor.UploadProgress = { i: 1, n: 1 },
  ): Promise<Editor.FileUploadResult> {
    if (
      fontUpload &&
      (uploaded.kind === null ||
        !runtime.FONT_FILE_EXTENSIONS.includes(uploaded.kind))
    ) {
      return {
        ok: false,
        reason: "not a woff2, woff, ttf, or otf font",
      };
    }
    let value = progress.batch ?? createUploadBatchState(),
      value2 = (0, runtime.canUseStoragePointer)(uploaded.name)
        ? await resolveAssetStorageApi(options)
        : null,
      value3 = resolveAssetUploadRoute(options, value2),
      value4 = options.freeing?.() ?? new Set(),
      state = {
        name: uploaded.name,
        type: uploaded.file.type,
        size: uploaded.file.size,
        font: fontUpload,
      },
      value5 = (0, runtime.chooseFileStorageRoute)(
        state,
        value.rateLimited
          ? {
              ...value3,
              tier: "off",
            }
          : value3,
      ),
      value6 =
        value5.to !== "blob" && (0, runtime.canUseStoragePointer)(uploaded.name)
          ? (0, runtime.chooseFileStorageRoute)(state, {
              ...value3,
              blobUsed: 0,
              blobCount: 0,
            })
          : null;
    if (value6 !== null && value6.to === "blob") {
      let value15 = deduplicatedUploadedAsset(
        value3.cat,
        await (0, runtime.sha256Hex)(
          new Uint8Array(await uploaded.file.arrayBuffer()),
        ),
        value4,
      );
      if (value15 !== null) {
        return commitUploadedAsset(uploaded, value15, value6.type, options);
      }
    }
    if (value5.to === "refuse") {
      if (
        value.rateLimited &&
        (0, runtime.chooseFileStorageRoute)(state, value3).to === "blob"
      ) {
        return {
          ok: false,
          reason: "rate-limited — add it again in a minute.",
        };
      } else {
        return failedAssetUploadResult(value5);
      }
    }
    let value7 = new Uint8Array(await uploaded.file.arrayBuffer()),
      value8 = (() => {
        let value15 = (0, runtime.classifyAssetUpload)(
          "",
          uploaded.kind,
          uploaded.file.size,
        );
        if (value15.mode === "original") {
          return value15.warning;
        } else {
          return undefined;
        }
      })(),
      callback = (input?: string): Editor.FileUploadResult => {
        let value15 = readUploadedFileValue(uploaded, value7);
        if ("reason" in value15) {
          return {
            ok: false,
            reason: value15.reason,
          };
        }
        if (
          (0, runtime.estimateEmbeddedStringBytes)(value15.value) >
          (options.room?.() ?? Number.POSITIVE_INFINITY)
        ) {
          return {
            ok: false,
            reason:
              "no room: a design system holds " +
              (0, runtime.formatInlineBudgetBytes)(
                runtime.DESIGN_SYSTEM_INLINE_LIMITS.total,
              ) +
              " in the page — remove something first",
          };
        }
        let value16 = input ?? value8;
        return {
          ok: true,
          fileName: uploaded.name,
          value: value15.value,
          tier: "inline",
          ...(value16 !== undefined
            ? {
                warning: value16,
              }
            : {}),
        };
      };
    if (
      value5.to === "inline" ||
      !(0, runtime.canUseStoragePointer)(uploaded.name)
    ) {
      return callback(
        value.rateLimited &&
          (0, runtime.chooseFileStorageRoute)(state, value3).to === "blob"
          ? "stored in the page instead — the store is rate-limited (drop it again later to move it)"
          : undefined,
      );
    }
    let value9 = options.now ?? (() => new Date().toISOString()),
      value10 = await (0, runtime.sha256Hex)(value7),
      value11 = deduplicatedUploadedAsset(value3.cat, value10, value4);
    if (value11 !== null) {
      return commitUploadedAsset(uploaded, value11, value5.type, options);
    }
    if (value2 === null) {
      return callback();
    }
    options.onProgress?.(
      (progress.n > 1
        ? "Uploading " +
          String(progress.i) +
          " of " +
          String(progress.n) +
          " · "
        : "Uploading ") + uploaded.name,
    );
    let value12 =
        uploaded.file.type === value5.type
          ? uploaded.file
          : new Blob([value7], {
              type: value5.type,
            }),
      value13 = await (0, runtime.uploadAssetWithRetry)(
        value2,
        value12,
        value5.type,
        {
          ...(options.sleep !== undefined
            ? {
                sleep: options.sleep,
              }
            : {}),
          now: value9,
          onWait: (input: number, options2: string) =>
            options.onProgress?.(
              (options2 === "rate_limited"
                ? "Uploads are being rate-limited — retrying "
                : "The store did not answer — retrying ") +
                uploaded.name +
                " in " +
                String(Math.round(input / 1000)) +
                " s (" +
                String(progress.i) +
                " of " +
                String(progress.n) +
                ")",
            ),
        },
      );
    if (value13.ok) {
      (0, runtime.setAssetsTierState)("on");
      (0, runtime.rememberOrphanedAsset)({
        id: value13.id,
        bytes: value13.bytes,
        path: uploaded.name,
        sha256: value10,
      });
      let state2: Model.AssetUploadRecord = {
        store: "blob",
        id: value13.id,
        sha256: value10,
        bytes: value13.bytes,
        type: value13.type,
        name: uploaded.file.name.slice(0, 200),
        addedAt: value9(),
        via: "page",
        ...(value13.url !== undefined
          ? {
              url: value13.url,
            }
          : {}),
      };
      return {
        ok: true,
        fileName: uploaded.name,
        value: (0, runtime.blobPointer)(value13.id),
        tier: "blob",
        record: state2,
      };
    }
    let type = value5.type;
    value5 = (0, runtime.chooseFileStorageRoute)(state, {
      ...resolveAssetUploadRoute(options, value2),
      tier: "off",
    });
    if (value13.kind === "tier-off" || value13.kind === "not-granted") {
      let value15: string =
        value13.kind === "not-granted" ? "not_granted" : "disabled";
      if ((0, runtime.setAssetsTierState)("off", value15)) {
        options.onTierOff?.(value15);
      }
      if (value5.to === "refuse") {
        return failedAssetUploadResult(value5);
      } else {
        return callback();
      }
    }
    if (value13.kind === "backoff") {
      value.rateLimited = true;
    }
    if (value5.to === "inline") {
      return callback(
        value13.kind === "inline-if-fits" || value13.kind === "quota"
          ? undefined
          : "stored in the page instead — the upload failed (" +
              value13.code +
              ")",
      );
    }
    let value14 = (0, runtime.assetUploadFailureMessage)(
      value13.kind,
      value13.code,
      uploaded.file.size,
      type,
    );
    if (
      (value13.kind === "too-large" || value13.kind === "inline-if-fits") &&
      value5.to === "refuse" &&
      value5.handOff !== undefined
    ) {
      return {
        ok: false,
        reason: value14,
        handOff: "too-large",
      };
    } else {
      return {
        ok: false,
        reason: value14,
      };
    }
  }
  function failedAssetUploadResult(
    result: Extract<Storage.UploadRoute, { to: "refuse" }>,
  ): Editor.FileUploadResult {
    return {
      ok: false,
      reason: result.reason,
      ...(result.handOff !== undefined
        ? {
            handOff: result.handOff,
          }
        : {}),
    };
  }
  function commitUploadedAssetChange(
    change: (mutate: Application.ContentMutation) => boolean,
    mutate: Application.ContentMutation,
    validateFile?: (
      path: string,
      value: string,
    ) => Application.FileSaveProblem | undefined,
  ): Application.UploadCommitResult {
    let problem: Editor.UploadProblem | undefined,
      result = change((input: Model.DesignSystemContent) => {
        problem = undefined;
        let value = mutate(input);
        if (value === input || validateFile === undefined) {
          return value;
        }
        for (let [value2, value3] of Object.entries(value.files)) {
          if (
            Object.hasOwn(input.files, value2) ||
            !(
              value2.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir) ||
              value2.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)
            )
          ) {
            continue;
          }
          let value4 =
            (0, runtime.storagePointerForFile)(value2, value3) === null
              ? validateFile(value2, value3)
              : undefined;
          if (value4 === undefined) {
            continue;
          }
          problem = {
            problem: value4,
            path: value2,
          };
          return input;
        }
        return value;
      });
    return problem ?? result;
  }
  function describeUploadProblem({
    problem: problem,
    path: path,
  }: Editor.UploadProblem): string {
    if (problem.forNow === true) {
      return "can’t be saved right now: reload the page, then add again";
    }
    if (problem.cause === "kind") {
      let value4 = (0, runtime.fileExtension)(path);
      if (value4 === "lottie") {
        return ".lottie files can’t be saved here: add the Lottie JSON instead";
      }
      if (["docx", "pptx", "xlsx"].includes(value4)) {
        return (
          "won’t open as a ." +
          value4 +
          " file, perhaps damaged or password-protected: use a fresh copy"
        );
      }
      if (value4 === "zip") {
        return "won’t open as a .zip file, perhaps damaged: use a fresh copy";
      }
      return UNSUPPORTED_UPLOAD_KIND_MESSAGE;
    }
    if (problem.cause !== "name") {
      return UPLOAD_REASON_MESSAGES[problem.cause];
    }
    let value = path.slice(path.lastIndexOf("/") + 1),
      value2 = path.slice(0, -value.length),
      value3 = /[%;#]/.test(value);
    if (/[%;:?#]/.test(value2)) {
      if (value3) {
        return "choose a set or folder name, and a file name, without % ; : ? or #";
      } else {
        return "choose a set or folder name without % ; : ? or #";
      }
    }
    if (value3) {
      return "rename the file without % ; or #";
    }
    if ((0, runtime.hasDamagedUnicode)(value)) {
      return "rename the file: the name has a damaged character";
    }
    if (value.endsWith(".cmekshadow")) {
      return UNSUPPORTED_UPLOAD_KIND_MESSAGE;
    }
    if ((0, runtime.hasDamagedUnicode)(value2)) {
      return "choose a set or folder name with no damaged character";
    } else {
      return "choose a shorter set or folder name";
    }
  }
  async function uploadAssetFiles(
    files: File[],
    group: Editor.AssetBatchUploadOptions,
    options?: string,
  ): Promise<Application.AssetUploadSummary> {
    let result: Application.AssetUploadSummary = {
        fonts: 0,
        assets: {},
        blobs: 0,
        refused: [],
        warnings: [],
      },
      state = createUploadBatchState(),
      resolvedFiles = files.filter(
        (input): boolean => !(0, runtime.isIgnoredUploadFile)(input),
      ),
      index: number = 0;
    for (let value of resolvedFiles) {
      index++;
      let value2:Editor.UploadDestination =
          options !== undefined &&
          !(0, runtime.isFontFile)(value.name, value.type)
            ? {
                to: "assets",
                group: options,
                subpath: "",
              }
            : (0, runtime.assetUploadDestination)(
                value.name,
                value.type,
                (0, runtime.uploadedFileRelativePath)(value),
              ),
        value3 = uploadedAssetFile(value);
      group.onProgress?.(
        (resolvedFiles.length > 1
          ? "Adding " +
            String(index) +
            " of " +
            String(resolvedFiles.length) +
            " · "
          : "Adding ") + value3.name,
      );
      let value4 = await uploadAssetFile(value3, value2.to === "fonts", group, {
        i: index,
        n: resolvedFiles.length,
        batch: state,
      });
      if (!value4.ok) {
        result.refused.push({
          name: value3.name,
          bytes: value3.file.size,
          reason: value4.reason.replace(/\.$/, ""),
          ...(value4.handOff !== undefined
            ? {
                handOff: value4.handOff,
              }
            : {}),
        });
        continue;
      }
      let value5 =
        value2.to === "fonts"
          ? group.font(
              {
                fileName: value4.fileName,
                value: value4.value,
                ...(0, runtime.inferFontMetadata)(value.name),
                ...(value4.record !== undefined
                  ? {
                      record: value4.record,
                    }
                  : {}),
              },
              value,
            )
          : group.asset(
              {
                group: value2.group,
                subpath: value2.subpath,
                fileName: value4.fileName,
                value: value4.value,
                ...(value4.record !== undefined
                  ? {
                      record: value4.record,
                    }
                  : {}),
              },
              value,
            );
      if (value5 !== true) {
        result.refused.push(
          value5 === false
            ? {
                name: value3.name,
                bytes: value3.file.size,
                reason: "it couldn’t be stored",
              }
            : {
                name: value3.name,
                bytes: value3.file.size,
                reason: describeUploadProblem(value5),
                atDoor: true,
              },
        );
        continue;
      }
      if (
        value4.warning !== undefined &&
        value4.warning.startsWith("stored in the page instead")
      ) {
        result.warnings.push(value3.name + " (" + value4.warning + ")");
      }
      if (value2.to === "fonts") {
        result.fonts++;
      } else {
        let value6 =
          value2.group === runtime.UNGROUPED_ASSETS_NAME ? "" : value2.group;
        result.assets[value6] = (result.assets[value6] ?? 0) + 1;
      }
      if (value4.tier === "blob") {
        result.blobs++;
      }
    }
    group.onProgress?.(null);
    return result;
  }
  async function existingFontUploadFiles(
    files: Model.FileTable,
    storage: Editor.AssetFileUploadOptions,
    options: (
      path: string,
      previous: string,
      next: string,
      record: Model.AssetUploadRecord,
    ) => boolean,
  ): Promise<number> {
    let value = Object.entries(files).filter(
      ([input, input2]) =>
        input.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir) &&
        (0, runtime.isFontFile)(input, "") &&
        input2.startsWith("data:"),
    );
    if (value.length === 0) {
      return 0;
    }
    let value2 = await resolveAssetStorageApi(storage);
    if (value2 === null || (0, runtime.getAssetsTierState)().state === "off") {
      return 0;
    }
    let value3 = createUploadBatchState(),
      index: number = 0;
    for (let [value4, [value5, value6]] of value.entries()) {
      let value7 = (0, runtime.downloadDataUrlBytes)(value6);
      if (value7 === null) {
        continue;
      }
      let value8 = value5.slice(runtime.DESIGN_SYSTEM_PATHS.fontsDir.length),
        value9 = new File([new Uint8Array(value7)], value8, {
          type: (0, runtime.parseDataUriHeader)(value6)?.mime ?? "",
        }),
        value10 = await uploadAssetFile(
          {
            file: value9,
            kind: (0, runtime.assetFileExtension)(value8, value9.type),
            name: value8,
          },
          true,
          {
            ...storage,
            api: value2,
          },
          {
            i: value4 + 1,
            n: value.length,
            batch: value3,
          },
        );
      if (!(value10.ok && value10.tier === "blob")) {
        break;
      }
      if (
        value10.record !== undefined &&
        options(value5, value6, value10.value, value10.record)
      ) {
        index++;
      }
    }
    storage.onProgress?.(null);
    return index;
  }
  function mergeAssetUploadResults(
    left: Application.AssetUploadSummary,
    right: Application.AssetUploadSummary,
  ): Application.AssetUploadSummary {
    let assets = {
      ...left.assets,
    };
    for (let [value, value2] of Object.entries(right.assets)) {
      assets[value] = (assets[value] ?? 0) + value2;
    }
    return {
      fonts: left.fonts + right.fonts,
      assets: assets,
      blobs: left.blobs + right.blobs,
      refused: [...left.refused, ...right.refused],
      warnings: [...left.warnings, ...right.warnings],
    };
  }
  function countSuccessfulUploads(
    result: Application.AssetUploadSummary,
  ): number {
    return (
      result.fonts +
      Object.values(result.assets).reduce(
        (input, options) => input + options,
        0,
      )
    );
  }
  function uploadDestinationSummary(
    result: Application.AssetUploadSummary,
  ): string[] {
    let parts: string[] = [];
    if (result.fonts > 0) {
      parts.push(String(result.fonts) + " to Font files");
    }
    let callback = (input: string) =>
      [runtime.ASSETS_SECTION_LABEL, "Font files"].some(
        (input2): boolean => input2.toLowerCase() === input.toLowerCase(),
      );
    for (let [value, value2] of Object.entries(result.assets)) {
      parts.push(
        String(value2) +
          " to " +
          (value === ""
            ? runtime.ASSETS_SECTION_LABEL
            : callback(value)
              ? "assets/" + value + "/"
              : value),
      );
    }
    return parts;
  }
  function addedFilesSummary(result: Application.AssetUploadSummary): string {
    let count = countSuccessfulUploads(result);
    if (count === 0) {
      return "";
    }
    let destinations = uploadDestinationSummary(result);
    return (
      ADDED_FILES_PREFIX +
      countedFileLabel(count) +
      (destinations.length === 1
        ? destinations[0].slice(String(count).length)
        : ": " + destinations.join(", "))
    );
  }
  function uploadedFilesBuildSummary(
    result: Application.AssetUploadSummary,
  ): string {
    let count = countSuccessfulUploads(result);
    if (count === 0) {
      return "";
    } else {
      return "Uploaded " + countedFileLabel(count) + " to build from";
    }
  }
  function uploadResultSummary(
    result: Application.AssetUploadSummary,
    leftOut: boolean,
    build: boolean = false,
  ): { text: string; handOff?: Application.RefusedUpload[] } | null {
    let count = countSuccessfulUploads(result),
      handoffs = result.refused.filter(
        (input): boolean => input.handOff !== undefined,
      ),
      items: string[] = [];
    if (count > 0) {
      items.push(
        addedFilesSummary(result) +
          (handoffs.length > 0 || build
            ? "."
            : leftOut
              ? // CucCut: user-facing copy calls the agent "the agent", not Claude.
                " — the agent will take it from here."
              : ". Save when you’re ready and the agent will take it from here."),
      );
    }
    if (result.warnings.length > 0) {
      items.push(
        "Kept in the page: " + joinLimitedUploadMessages(result.warnings) + ".",
      );
    }
    for (let value of ["figma", "too-large", undefined]) {
      let value2 = result.refused.filter(
        (input): boolean => input.handOff === value,
      );
      if (value2.length > 0) {
        items.push(failedUploadSummary(value, value2));
      }
    }
    if (items.length === 0) {
      return null;
    }
    return {
      text: items.join(" "),
      ...(handoffs.length > 0
        ? {
            handOff: handoffs,
          }
        : {}),
    };
  }
  function joinLimitedUploadMessages(messages: string[]): string {
    if (messages.length <= MAX_UPLOAD_SUMMARY_ITEMS) {
      return messages.join("; ");
    } else {
      return (
        messages.slice(0, MAX_UPLOAD_SUMMARY_ITEMS).join("; ") +
        "; and " +
        String(messages.length - MAX_UPLOAD_SUMMARY_ITEMS) +
        " more"
      );
    }
  }
  function summarizeUploadItems<T>(
    items: T[],
    label: (item: T) => string,
  ): string {
    let value = items.slice(0, MAX_UPLOAD_SUMMARY_ITEMS).map(label),
      value2 =
        items.length > MAX_UPLOAD_SUMMARY_ITEMS
          ? String(items.length - MAX_UPLOAD_SUMMARY_ITEMS) + " more"
          : (value.pop() ?? "");
    if (value.length === 0) {
      return value2;
    } else {
      return value.join(", ") + " and " + value2;
    }
  }
  function failedUploadSummary(
    result: string | undefined,
    files: Application.RefusedUpload[],
  ): string {
    let value: boolean = files.length === 1,
      value2: string = value ? " was not uploaded" : " were not uploaded";
    if (result === "figma") {
      return (
        summarizeUploadItems(files, (input) =>
          (0, runtime.truncateHandoffFileName)(input.name),
        ) +
        value2 +
        " — add the " +
        (value ? "file or its share link" : "files or their share links") +
        " in the chat instead."
      );
    }
    if (result === "too-large") {
      return (
        summarizeUploadItems(files, (input) =>
          (0, runtime.truncateHandoffFileName)(input.name),
        ) +
        value2 +
        " — " +
        (value ? "it’s" : "they’re") +
        " too large, attach " +
        (value ? "it" : "them") +
        " in the chat instead."
      );
    }
    let callback = (input: string, options: number): string =>
        input + (options === 1 ? " was not uploaded." : " were not uploaded."),
      callback2 = (items: Application.RefusedUpload[]) =>
        callback(
          summarizeUploadItems(
            items,
            (input): string =>
              (0, runtime.truncateHandoffFileName)(input.name) +
              " (" +
              input.reason +
              ")",
          ),
          items.length,
        ),
      entries = new Map<string, Application.RefusedUpload[]>();
    for (let value6 of files) {
      if (value6.atDoor === true) {
        entries.set(value6.reason, [
          ...(entries.get(value6.reason) ?? []),
          value6,
        ]);
      }
    }
    let value3 = files.filter((input): boolean => input.atDoor !== true);
    if (
      entries.size === files.length - value3.length &&
      files.length <= MAX_UPLOAD_ERROR_DETAILS
    ) {
      return callback2(files);
    }
    let value4 = [...entries.entries()].sort(
        (input, options) => options[1].length - input[1].length,
      ),
      value5 = value4
        .slice(MAX_UPLOAD_ERROR_DETAILS)
        .reduce((input, [, items]) => input + items.length, 0);
    return [
      ...(value3.length === 0 ? [] : [callback2(value3)]),
      ...value4
        .slice(0, MAX_UPLOAD_ERROR_DETAILS)
        .map(([input, items]) =>
          callback(
            summarizeUploadItems(items, (input2) =>
              (0, runtime.truncateHandoffFileName)(input2.name),
            ) +
              " (" +
              input +
              ")",
            items.length,
          ),
        ),
      ...(value5 === 0
        ? []
        : [
            callback(
              String(value5) + (value5 === 1 ? " more file" : " more files"),
              value5,
            ),
          ]),
    ].join(" ");
  }
  function uploadFileBaseName(fileName: string): string {
    let baseName = fileName.trim().replace(/^.*[\\/]/, "");
    if (baseName !== "") {
      return baseName;
    } else {
      return (0, runtime.assetNameFromFileName)(fileName);
    }
  }
  function pickUploadFiles(
    multiple: boolean = false,
    accept?: string,
  ): Promise<File[]> {
    return new Promise<File[]>((input): void => {
      let value = document.createElement("input");
      value.type = "file";
      value.multiple = true;
      if (accept !== undefined) {
        value.accept = accept;
      }
      if (multiple) {
        value.webkitdirectory = true;
      }
      value.style.position = "fixed";
      value.style.left = "-9999px";
      let callback = (input2: File[]): void => {
        value.remove();
        input(input2);
      };
      value.addEventListener(
        "change",
        () =>
          callback(
            Array.from(value.files ?? []).filter(
              (input2): boolean => !(0, runtime.isIgnoredUploadFile)(input2),
            ),
          ),
        {
          once: true,
        },
      );
      value.addEventListener("cancel", () => callback([]), {
        once: true,
      });
      document.body.appendChild(value);
      value.click();
    });
  }
  bindRuntimeValue(runtime, "uploadedAssetFile", () => uploadedAssetFile);
  bindRuntimeValue(
    runtime,
    "createUploadBatchState",
    () => createUploadBatchState,
  );
  bindRuntimeValue(
    runtime,
    "resolveAssetUploadRoute",
    () => resolveAssetUploadRoute,
  );
  bindRuntimeValue(
    runtime,
    "resolveAssetStorageApi",
    () => resolveAssetStorageApi,
  );
  bindRuntimeValue(
    runtime,
    "readUploadedFileValue",
    () => readUploadedFileValue,
  );
  bindRuntimeValue(
    runtime,
    "deduplicatedUploadedAsset",
    () => deduplicatedUploadedAsset,
  );
  bindRuntimeValue(runtime, "commitUploadedAsset", () => commitUploadedAsset);
  bindRuntimeValue(runtime, "uploadAssetFile", () => uploadAssetFile);
  bindRuntimeValue(
    runtime,
    "failedAssetUploadResult",
    () => failedAssetUploadResult,
  );
  bindRuntimeValue(
    runtime,
    "commitUploadedAssetChange",
    () => commitUploadedAssetChange,
  );
  bindRuntimeValue(
    runtime,
    "UNSUPPORTED_UPLOAD_KIND_MESSAGE",
    () => UNSUPPORTED_UPLOAD_KIND_MESSAGE,
    (value) => {
      UNSUPPORTED_UPLOAD_KIND_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UPLOAD_REASON_MESSAGES",
    () => UPLOAD_REASON_MESSAGES,
    (value) => {
      UPLOAD_REASON_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeUploadProblem",
    () => describeUploadProblem,
  );
  bindRuntimeValue(runtime, "uploadAssetFiles", () => uploadAssetFiles);
  bindRuntimeValue(
    runtime,
    "existingFontUploadFiles",
    () => existingFontUploadFiles,
  );
  bindRuntimeValue(
    runtime,
    "mergeAssetUploadResults",
    () => mergeAssetUploadResults,
  );
  bindRuntimeValue(
    runtime,
    "countSuccessfulUploads",
    () => countSuccessfulUploads,
  );
  bindRuntimeValue(
    runtime,
    "uploadDestinationSummary",
    () => uploadDestinationSummary,
  );
  bindRuntimeValue(
    runtime,
    "countedFileLabel",
    () => countedFileLabel,
    (value) => {
      countedFileLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ADDED_FILES_PREFIX",
    () => ADDED_FILES_PREFIX,
    (value) => {
      ADDED_FILES_PREFIX = value;
    },
  );
  bindRuntimeValue(runtime, "addedFilesSummary", () => addedFilesSummary);
  bindRuntimeValue(
    runtime,
    "uploadedFilesBuildSummary",
    () => uploadedFilesBuildSummary,
  );
  bindRuntimeValue(runtime, "uploadResultSummary", () => uploadResultSummary);
  bindRuntimeValue(
    runtime,
    "MAX_UPLOAD_SUMMARY_ITEMS",
    () => MAX_UPLOAD_SUMMARY_ITEMS,
    (value) => {
      MAX_UPLOAD_SUMMARY_ITEMS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_UPLOAD_ERROR_DETAILS",
    () => MAX_UPLOAD_ERROR_DETAILS,
    (value) => {
      MAX_UPLOAD_ERROR_DETAILS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "joinLimitedUploadMessages",
    () => joinLimitedUploadMessages,
  );
  bindRuntimeValue(runtime, "summarizeUploadItems", () => summarizeUploadItems);
  bindRuntimeValue(runtime, "failedUploadSummary", () => failedUploadSummary);
  bindRuntimeValue(runtime, "uploadFileBaseName", () => uploadFileBaseName);
  bindRuntimeValue(runtime, "pickUploadFiles", () => pickUploadFiles);
  return () => {
    UNSUPPORTED_UPLOAD_KIND_MESSAGE =
      "this kind of file can’t be saved here: convert to another format";
    UPLOAD_REASON_MESSAGES = {
      damaged_text: "fix the damaged character in the text, then add again",
      size: "too large to save here",
      unreadable: "contents could not be read",
      gone: "can’t be saved here",
      other: "can’t be saved here",
    };
    countedFileLabel = (count: number): string =>
      String(count) + (count === 1 ? " file" : " files");
    ADDED_FILES_PREFIX = "Added ";
    MAX_UPLOAD_SUMMARY_ITEMS = 5;
    MAX_UPLOAD_ERROR_DETAILS = 3;
  };
}
