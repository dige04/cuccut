import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelStoreConversion(
  runtime: RuntimeBindings,
): () => void {
  var collectionOverflowConversionMessage: (collection: string) => string;
  var collectionFileOverflowMessage: (collection: string) => string;
  var BLOB_FILE_COUNT_OVERFLOW_MESSAGE: string;
  var MAX_CARRIED_FILE_REFERRERS: number;
  function planSystemStoreConversion(
    title: string,
    files: Model.FileTable,
    options: Storage.ConversionOptions = {},
  ): Storage.ConversionPlan {
    let documents = new Map<string, Storage.DatabaseRecord>(),
      uploads: Storage.ConversionUpload[] = [],
      carried = [
        ...(options.precarried ?? []).map((input) => ({
          ...input,
        })),
      ],
      catalog = (0, runtime.storageCatalogFromManifest)(
        files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
      );
    documents.set(
      runtime.SYSTEM_META_DOCUMENT_PATH,
      (0, runtime.makeStoredSystemMetadata)(title, files, options.meta),
    );
    let setFileRecord = (input: string, options2: Storage.DatabaseRecord) =>
        void documents.set(
          (0, runtime.rawDocumentPathForFile)(input),
          options2,
        ),
      bytesForPath = (input: string, options2: string) =>
        options.binaries?.get(input)?.bytes ??
        (0, runtime.fileContentBytesModelStoredFileCodec)(options2, input),
      digestForPath = (input: string, options2: () => Uint8Array) =>
        options.binaries?.get(input)?.sha256 ??
        (options.sha256 !== undefined ? options.sha256(options2()) : undefined),
      binarySize = (input: string) =>
        options.binaries?.get(input)?.bytes?.length,
      omitFile = (input: string, options2: string) =>
        void carried.push({
          path: input,
          reason: options2,
          form: "omitted",
        }),
      knownByDigest = new Map<string, Storage.KnownUpload>(),
      useOrQueueBlob = (
        input: string,
        options2: string,
        context: string,
        value?: Storage.BinaryFile,
      ): boolean => {
        let value2 = options.known?.get(input);
        if (value2 === null) {
          omitFile(input, runtime.FAILED_CONVERSION_UPLOAD_MESSAGE);
          return false;
        }
        let callback = () => value?.bytes ?? bytesForPath(input, options2),
          callback2 = () =>
            value?.sha256 ??
            (value !== undefined && options.sha256 !== undefined
              ? options.sha256(value.bytes)
              : digestForPath(input, callback)),
          value3 =
            value2 === undefined
              ? null
              : (0, runtime.normalizeKnownUpload)(value2);
        if (value3 !== null) {
          let value4 = value3.sha256 ?? callback2(),
            state = {
              bytes:
                value3.bytes ??
                value?.bytes.length ??
                binarySize(input) ??
                (0, runtime.storedContentByteLength)(options2, input),
              contentType: value3.contentType ?? context,
              sha256: value4,
              storedSha256: value3.storedSha256,
              ...options.stamp,
              id: value3.id,
            };
          setFileRecord(
            input,
            (0, runtime.makeRemoteFileRecord)(
              input,
              (0, runtime.blobAbsoluteUrl)(value3.id),
              {
                ...state,
                name: (0, runtime.storedPathBasename)(input),
              },
            ),
          );
          if (value4 !== undefined) {
            knownByDigest.set(value4 + "|" + state.contentType, state);
          }
          return true;
        }
        (0, runtime.addConversionUpload)(
          uploads,
          input,
          context,
          callback(),
          callback2(),
        );
        return true;
      },
      convertFile = (input: string, options2: string): void => {
        let value = (0, runtime.chooseStoredConversionRoute)(
          input,
          options2,
          binarySize(input),
        );
        if (value.to === "inline") {
          setFileRecord(input, {
            path: input,
            kind: (0, runtime.storedFileKind)(input),
            data: options2,
          });
        } else if (value.to === "data-uri") {
          setFileRecord(input, {
            path: input,
            kind: (0, runtime.storedFileKind)(input),
            data: options2,
          });
          carried.push({
            path: input,
            reason: value.carried,
            form: "data-uri",
          });
        } else if (value.to === "omit") {
          omitFile(input, value.carried);
        } else if (
          useOrQueueBlob(input, options2, value.contentType) &&
          value.carried !== undefined
        ) {
          carried.push({
            path: input,
            reason: value.carried,
            form: "blob",
          });
        }
      };
    for (let value of Object.keys(files).sort()) {
      if (
        value === runtime.DESIGN_SYSTEM_PATHS.manifest ||
        value === runtime.DESIGN_SYSTEM_PATHS.readme
      ) {
        continue;
      }
      let value2 = files[value],
        value3 = (0, runtime.explainUnsafeMirrorPath)(value);
      if (value3 !== null) {
        omitFile(value, "its name " + value3 + ", so it was left out");
        continue;
      }
      if (value === runtime.DESIGN_SYSTEM_PATHS.tokens) {
        let value5 = (0, runtime.chooseStoredConversionRoute)(value, value2),
          value6 =
            value5.to === "inline"
              ? (0, runtime.parseJsonObjectOrNull)(
                  (0, runtime.tokensJsonWithManifestName)(files),
                )
              : null;
        if (value6 !== null) {
          documents.set(runtime.SYSTEM_TOKENS_DOCUMENT_PATH, value6);
        } else if (value5.to === "inline") {
          setFileRecord(value, {
            path: value,
            kind: "text",
            data: value2,
          });
          carried.push({
            path: value,
            reason:
              "it is not a JSON object, so it is kept as text and the page shows no tokens",
            form: "text-doc",
          });
        } else if (
          value5.to === "blob" &&
          useOrQueueBlob(value, value2, value5.contentType!)
        ) {
          carried.push({
            path: value,
            reason:
              (value5.carried ?? "it is stored as a file") +
              "; the page shows no tokens",
            form: "blob",
          });
        } else if (value5.to === "omit") {
          omitFile(value, value5.carried);
        }
        continue;
      }
      let value4 = (0, runtime.storagePointerForFile)(value, value2);
      if (value4 === null || value4.store === "file") {
        convertFile(value, value2);
      } else if ((0, runtime.isPendingBlobId)(value4.id)) {
        if (
          options.known?.has(value) === true ||
          options.binaries?.get(value)?.bytes !== undefined
        ) {
          useOrQueueBlob(
            value,
            value2,
            (0, runtime.storedContentType)(value) ??
              (0, runtime.storageRecordForFile)(files, catalog, value)!.type,
          );
        } else {
          omitFile(
            value,
            "its stored copy was never uploaded (it names a placeholder, not a file), so it was left out",
          );
        }
      } else {
        let value5 = (0, runtime.storageRecordForFile)(files, catalog, value)!;
        setFileRecord(
          value,
          (0, runtime.makeRemoteFileRecord)(
            value,
            (0, runtime.blobAbsoluteUrl)(value4.id),
            {
              bytes: value5.bytes,
              contentType: value5.type,
              sha256: value5.sha256,
              storedSha256: value5.storedSha256,
              name: value5.name,
              addedAt: value5.addedAt,
              via: value5.via,
            },
          ),
        );
      }
    }
    for (let [value, value2] of [...(options.detached ?? [])].sort(
      ([input], [options2]): number =>
        input < options2 ? -1 : input > options2 ? 1 : 0,
    )) {
      if (
        !(0, runtime.isValidDesignSystemPath)(value) ||
        Object.hasOwn(files, value) ||
        value === runtime.DESIGN_SYSTEM_PATHS.readme ||
        value === runtime.DESIGN_SYSTEM_PATHS.manifest ||
        value === runtime.DESIGN_SYSTEM_PATHS.tokens
      ) {
        continue;
      }
      let value3 = (0, runtime.explainUnsafeMirrorPath)(value);
      if (value3 !== null) {
        omitFile(value, "its name " + value3 + ", so it was left out");
        continue;
      }
      useOrQueueBlob(
        value,
        "",
        (0, runtime.storedContentType)(value) ?? "text/plain",
        value2,
      );
    }
    if (options.derived !== false) {
      let value = (0, runtime.consumptionDocumentationForFiles)(files),
        value2 = (0, runtime.mergeReadmeWithGeneratedTail)(
          files[runtime.DESIGN_SYSTEM_PATHS.readme] ?? "",
          (0, runtime.generatedReadmeTail)(value.readme),
        );
      if (value2 !== "") {
        convertFile(runtime.DESIGN_SYSTEM_PATHS.readme, value2);
      }
      for (let [value4, value5] of value.files) {
        convertFile(value4, value5);
      }
      let value3 = (0, runtime.generatedTokensCssForFiles)(files);
      if (value3 !== null) {
        convertFile(runtime.GENERATED_TOKENS_CSS_PATH, value3);
      }
    }
    for (let value of [...uploads]) {
      let value2 =
        value.sha256 === undefined
          ? undefined
          : knownByDigest.get(value.sha256 + "|" + value.contentType);
      if (value2 === undefined) {
        continue;
      }
      uploads.splice(uploads.indexOf(value), 1);
      for (let value3 of value.paths) {
        setFileRecord(
          value3,
          (0, runtime.makeRemoteFileRecord)(
            value3,
            (0, runtime.blobAbsoluteUrl)(value2.id),
            {
              ...value2,
              bytes: value.byteLength,
              name: (0, runtime.storedPathBasename)(value3),
            },
          ),
        );
      }
    }
    let plan = enforceConversionBudgets(
        {
          title: title,
          docs: documents,
          uploads: uploads,
          carried: carried,
        },
        options.sha256,
      ),
      knownUploads = options.known;
    if (
      knownUploads !== undefined &&
      plan.uploads.some((input) =>
        input.paths.some((input2) => knownUploads.has(input2)),
      )
    ) {
      return applyKnownConversionUploads(
        plan,
        knownUploads,
        options.stamp ?? {},
      );
    } else {
      return (0, runtime.appendStoredFilesGuidance)(plan);
    }
  }
  function applyKnownConversionUploads(
    plan: Storage.ConversionPlan,
    knownUploads: ReadonlyMap<string, Storage.KnownUploadInput | null>,
    stamp: Storage.UploadStamp = {},
  ): Storage.ConversionPlan {
    let documents = new Map(plan.docs),
      uploads: Storage.ConversionUpload[] = [],
      carried = [...plan.carried];
    for (let value of plan.uploads) {
      let value2 = value.paths.find((input) => knownUploads.has(input)),
        value3 = value2 === undefined ? undefined : knownUploads.get(value2),
        value4 =
          value3 === undefined || value3 === null
            ? null
            : (0, runtime.normalizeKnownUpload)(value3);
      if (value3 === undefined || (value3 !== null && value4 === null)) {
        uploads.push(value);
      } else {
        for (let value5 of value.paths) {
          if (value4 === null) {
            carried.push({
              path: value5,
              reason: runtime.FAILED_CONVERSION_UPLOAD_MESSAGE,
              form: "omitted",
            });
          } else {
            documents.set(
              (0, runtime.rawDocumentPathForFile)(value5),
              (0, runtime.makeRemoteFileRecord)(
                value5,
                (0, runtime.blobAbsoluteUrl)(value4.id),
                {
                  bytes: value4.bytes ?? value.byteLength,
                  contentType: value4.contentType ?? value.contentType,
                  sha256: value4.sha256 ?? value.sha256,
                  storedSha256: value4.storedSha256,
                  name: (0, runtime.storedPathBasename)(value5),
                  ...stamp,
                },
              ),
            );
          }
        }
      }
    }
    return (0, runtime.appendStoredFilesGuidance)(
      enforceConversionBudgets({
        title: plan.title,
        docs: documents,
        uploads: uploads,
        carried: carried,
      }),
    );
  }
  function conversionFileReferrers(
    plan: Storage.ConversionPlan,
  ): Map<string, string[]> {
    let referrers = new Map<string, Set<string>>(),
      addReference = (input: string | null, options: string): void => {
        if (input === null || input === "") {
          return;
        }
        referrers.set(input, (referrers.get(input) ?? new Set()).add(options));
      },
      readmes: [string, string][] = [];
    for (let [, value] of plan.docs) {
      let value2 = (0, runtime.stringOrUndefined)(value.path),
        value3 = (0, runtime.stringOrUndefined)(value.data);
      if (value2 === undefined || value3 === undefined) {
        continue;
      }
      if (
        (0, runtime.classifyDesignSystemFile)(value2) === "preview" ||
        (0, runtime.classifyDesignSystemFile)(value2) === "componentReadme"
      ) {
        for (let value4 of (0, runtime.componentFileReferences)(
          value2,
          value3,
        )) {
          addReference(
            (0, runtime.resolveLocalFileReference)(value2, value4),
            value2,
          );
        }
      }
      if (
        value2 === runtime.DESIGN_SYSTEM_PATHS.readme ||
        ((0, runtime.classifyDesignSystemFile)(value2) === "doc" &&
          !(0, runtime.isGeneratedApiPath)(value2)) ||
        (value2.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir) &&
          (0, runtime.fileExtension)(value2) === "md")
      ) {
        readmes.push([
          value2,
          value2 === runtime.DESIGN_SYSTEM_PATHS.readme
            ? (0, runtime.stripGeneratedReadmeTail)(value3)
            : value3,
        ]);
      }
    }
    for (let value of plan.uploads) {
      if ((0, runtime.fileExtension)(value.path) === "css") {
        for (let value2 of new TextDecoder()
          .decode(value.bytes)
          .matchAll(runtime.CSS_FILE_REFERENCE_PATTERN)) {
          addReference(
            (0, runtime.resolveLocalFileReference)(
              value.path,
              value2[1] ?? value2[2] ?? value2[3] ?? "",
            ),
            value.path,
          );
        }
      }
    }
    let tokensRecord = plan.docs.get(runtime.SYSTEM_TOKENS_DOCUMENT_PATH);
    if (tokensRecord !== undefined) {
      for (let value of (0, runtime.parseTokens)(tokensRecord).type.fonts) {
        addReference(value.file, runtime.DESIGN_SYSTEM_PATHS.tokens);
      }
    }
    if (readmes.length > 0) {
      for (let value of new Set([
        ...[...plan.docs.values()].map(
          (input) => (0, runtime.stringOrUndefined)(input.path) ?? "",
        ),
        ...plan.uploads.flatMap((input) => input.paths),
      ])) {
        if (!value.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
          continue;
        }
        for (let [value2, value3] of readmes) {
          if (
            value3.includes(value) ||
            value3.includes((0, runtime.storedPathBasename)(value))
          ) {
            addReference(value, value2);
          }
        }
      }
    }
    return new Map(
      [...referrers]
        .sort(([input], [options]): number => (input < options ? -1 : 1))
        .map(([input, input2]) => [input, [...input2].sort()]),
    );
  }
  function conversionFilePriority(
    plan: Storage.ConversionPlan,
    referrers: ReadonlyMap<string, string[]> = conversionFileReferrers(plan),
  ): Map<string, number> {
    let metadata = (0, runtime.parseStoredSystemMetadata)(
        plan.docs.get(runtime.SYSTEM_META_DOCUMENT_PATH),
      ),
      groupOrder = (metadata?.assetGroups ?? []).map(
        (input) => (input as Storage.StoredPriorityGroup).name,
      ),
      paths = [
        ...new Set([
          ...[...plan.docs.values()].map(
            (input) => (0, runtime.stringOrUndefined)(input.path) ?? "",
          ),
          ...plan.uploads.flatMap((input) => input.paths),
        ]),
      ].filter((input): boolean => input !== ""),
      priority = (input: string) => {
        if (!input.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
          return [0];
        }
        let value = input
            .slice(runtime.DESIGN_SYSTEM_PATHS.assetsDir.length)
            .split("/"),
          value2 = value.length > 1 ? groupOrder.indexOf(value[0]) : -1,
          value3 =
            value2 < 0
              ? []
              : ((
                  metadata?.assetGroups?.[value2] as
                    | Storage.StoredPriorityGroup
                    | undefined
                )?.order ?? []),
          value4 = value3.indexOf(value.slice(1).join("/"));
        return [
          referrers.has(input) ? 1 : 2,
          value2 < 0 ? groupOrder.length : value2,
          value4 < 0 ? value3.length : value4,
        ];
      },
      ranked = paths.map((input) => ({
        p: input,
        r: priority(input),
      }));
    ranked.sort((input, options) => {
      for (let index: number = 0; index < 3; index++) {
        let value = (input.r[index] ?? 0) - (options.r[index] ?? 0);
        if (value !== 0) {
          return value;
        }
      }
      if (input.p < options.p) {
        return -1;
      } else {
        if (input.p > options.p) {
          return 1;
        } else {
          return 0;
        }
      }
    });
    return new Map(ranked.map((input, options) => [input.p, options]));
  }
  function enforceConversionBudgets(
    plan: Storage.ConversionPlan,
    sha2562?: (bytes: Uint8Array) => string,
  ): Storage.ConversionPlan {
    let documents = new Map(plan.docs),
      uploads = plan.uploads.map((input) => ({
        ...input,
        paths: [...input.paths],
      })),
      carried: Storage.CarriedFile[] = [],
      carry = (input: Storage.CarriedFile): void => {
        let value = carried.findIndex(
          (input2): boolean => input2.path === input.path,
        );
        if (value >= 0) {
          carried.splice(value, 1);
        }
        carried.push(input);
      };
    for (let value of plan.carried) {
      carry({
        path: value.path,
        reason: value.reason,
        form: value.form,
        ...(value.referrers !== undefined
          ? {
              referrers: [...value.referrers],
            }
          : {}),
      });
    }
    let referrers: Map<string, string[]> | undefined,
      priority: Map<string, number> | undefined,
      filePriority = () => {
        referrers ??= conversionFileReferrers(plan);
        priority ??= conversionFilePriority(plan, referrers);
        return priority;
      },
      comparePriority = (input: string, options: string) =>
        (filePriority().get(input) ?? 0) - (filePriority().get(options) ?? 0) ||
        (input < options ? -1 : 1),
      uploadForPath = (input: string) =>
        uploads.find((input2) => input2.paths.includes(input)),
      pathsInCollection = (input: string) =>
        [
          ...new Set([
            ...[...documents]
              .filter(
                ([input2]): boolean => documentCollectionPath(input2) === input,
              )
              .map(
                ([, input2]) =>
                  (0, runtime.stringOrUndefined)(input2.path) ??
                  (input === runtime.SYSTEM_COLLECTION ? "" : ""),
              ),
            ...uploads
              .flatMap((input2) => input2.paths)
              .filter(
                (input2): boolean =>
                  documentCollectionPath(
                    (0, runtime.rawDocumentPathForFile)(input2),
                  ) === input,
              ),
          ]),
        ].filter((input2): boolean => input2 !== ""),
      documentBytes = (input: string) =>
        documents.has((0, runtime.rawDocumentPathForFile)(input))
          ? (0, runtime.estimateEmbeddedJsonBytes)(
              documents.get((0, runtime.rawDocumentPathForFile)(input)),
            )
          : 512,
      omitPath = (input: string, options: string): void => {
        documents.delete((0, runtime.rawDocumentPathForFile)(input));
        let value = uploadForPath(input);
        if (value !== undefined) {
          if (
            ((value.paths = value.paths.filter(
              (input2): boolean => input2 !== input,
            )),
            value.paths.length === 0)
          ) {
            uploads.splice(uploads.indexOf(value), 1);
          } else {
            value.path = value.paths[0];
            value.docPath = (0, runtime.rawDocumentPathForFile)(value.path);
          }
        }
        carry({
          path: input,
          reason: options,
          form: "omitted",
        });
      };
    for (let value of runtime.DESIGN_SYSTEM_COLLECTIONS) {
      if (value === runtime.SYSTEM_COLLECTION) {
        continue;
      }
      let value2 = pathsInCollection(value),
        value3 = value2
          .filter((input) =>
            carried.some(
              (input2) => input2.path === input && input2.form === "data-uri",
            ),
          )
          .sort(
            (input, options) =>
              documentBytes(options) - documentBytes(input) ||
              (input < options ? -1 : 1),
          ),
        value4 = value3.reduce(
          (input, options) => input + documentBytes(options),
          0,
        );
      for (let value6 of value3) {
        if (
          value4 <=
          runtime.MAX_INLINE_DATA_URI_BUDGET_FRACTION *
            runtime.MAX_SYNC_COLLECTION_BYTES
        ) {
          break;
        }
        value4 -= documentBytes(value6);
        omitPath(
          value6,
          "the store takes no " +
            (0, runtime.fileKindDescription)(value6) +
            " and " +
            value +
            "/ already holds its " +
            (0, runtime.formatStoredFileKilobytes)(
              runtime.MAX_INLINE_DATA_URI_BUDGET_FRACTION *
                runtime.MAX_SYNC_COLLECTION_BYTES,
            ) +
            " of such files inline, so it was left out",
        );
      }
      value2 = pathsInCollection(value);
      let value5 = value2.reduce(
        (input, options) => input + documentBytes(options),
        0,
      );
      if (value5 > runtime.MAX_SYNC_COLLECTION_BYTES) {
        let value6 = value2
          .filter((input) => {
            let entry = documents.get(
              (0, runtime.rawDocumentPathForFile)(input),
            );
            return (
              entry !== undefined &&
              typeof entry.data === "string" &&
              (0, runtime.isTextFilePath)(input) &&
              (0, runtime.storedContentType)(input) !== null
            );
          })
          .sort(
            (input, options) =>
              documentBytes(options) - documentBytes(input) ||
              (input < options ? -1 : 1),
          );
        for (let value7 of value6) {
          if (value5 <= runtime.MAX_SYNC_COLLECTION_BYTES) {
            break;
          }
          let entry = documents.get(
            (0, runtime.rawDocumentPathForFile)(value7),
          );
          value5 -= (0, runtime.estimateEmbeddedJsonBytes)(entry) - 512;
          documents.delete((0, runtime.rawDocumentPathForFile)(value7));
          let value8 = runtime.storedFileEncoder.encode(entry!.data as string);
          (0, runtime.addConversionUpload)(
            uploads,
            value7,
            (0, runtime.storedContentType)(value7)!,
            value8,
            sha2562?.(value8),
          );
          carry({
            path: value7,
            reason: collectionOverflowConversionMessage(value),
            form: "blob",
          });
        }
        value2 = pathsInCollection(value);
      }
      if (value2.length > runtime.MAX_FILES_PER_COLLECTION) {
        let value6 = value2.sort(comparePriority);
        while (value6.length > runtime.MAX_FILES_PER_COLLECTION) {
          omitPath(value6.pop()!, collectionFileOverflowMessage(value));
        }
      }
    }
    let storageIdentity = (input: string): string | null => {
        let entry = documents.get((0, runtime.rawDocumentPathForFile)(input)),
          value =
            entry !== undefined
              ? (0, runtime.blobIdFromReference)(
                  (0, runtime.stringOrUndefined)(entry.dataRef) ?? "",
                )
              : null;
        if (value !== null) {
          return "id:" + value;
        }
        let value2 = uploadForPath(input);
        if (value2 === undefined) {
          return null;
        } else {
          if (value2.sha256 !== undefined) {
            return "sha:" + value2.sha256 + "|" + value2.contentType;
          } else {
            return "path:" + value2.path;
          }
        }
      },
      storageIdentityByPath = new Map<string, string>();
    for (let value of new Set([
      ...[...documents.values()].map(
        (input) => (0, runtime.stringOrUndefined)(input.path) ?? "",
      ),
      ...uploads.flatMap((input) => input.paths),
    ])) {
      let value2 = value === "" ? null : storageIdentity(value);
      if (value2 !== null) {
        storageIdentityByPath.set(value, value2);
      }
    }
    let referenceCounts = new Map<string, number>();
    for (let value of storageIdentityByPath.values()) {
      referenceCounts.set(value, (referenceCounts.get(value) ?? 0) + 1);
    }
    let storedFileCount = referenceCounts.size;
    if (storedFileCount > runtime.BLOB_STORAGE_LIMITS.files) {
      let value = [...storageIdentityByPath.keys()].sort(comparePriority);
      while (
        storedFileCount > runtime.BLOB_STORAGE_LIMITS.files &&
        value.length > 0
      ) {
        let value2 = value.pop()!;
        if (
          (0, runtime.classifyDesignSystemFile)(value2) !== "asset" &&
          (0, runtime.classifyDesignSystemFile)(value2) !== "componentOther"
        ) {
          continue;
        }
        let entry = storageIdentityByPath.get(value2)!;
        omitPath(value2, BLOB_FILE_COUNT_OVERFLOW_MESSAGE);
        let value3: number = referenceCounts.get(entry)! - 1;
        referenceCounts.set(entry, value3);
        if (value3 === 0) {
          storedFileCount--;
        }
      }
    }
    if (carried.length > 0) {
      referrers ??= conversionFileReferrers(plan);
    }
    for (let value of carried) {
      let value2 = referrers?.get(value.path);
      if (value2 !== undefined) {
        value.referrers = [
          ...new Set([...(value.referrers ?? []), ...value2]),
        ].sort();
      }
    }
    let metadata = documents.get(runtime.SYSTEM_META_DOCUMENT_PATH);
    if (metadata !== undefined) {
      documents.set(
        runtime.SYSTEM_META_DOCUMENT_PATH,
        metadataWithCarriedFiles(metadata, carried),
      );
    }
    return {
      title: plan.title,
      docs: documents,
      uploads: uploads,
      carried: carried,
    };
  }
  function metadataWithCarriedFiles(
    metadata: Storage.DatabaseRecord,
    carried: readonly Storage.CarriedFile[],
  ): Storage.DatabaseRecord {
    let {
        carried: previousCarried,
        carriedMore: previousMore,
        ...base
      } = metadata,
      records = carried.map((input) => ({
        path: input.path,
        reason: input.reason,
        form: input.form,
        ...(input.referrers !== undefined
          ? {
              referrers: input.referrers.slice(0, MAX_CARRIED_FILE_REFERRERS),
              ...(input.referrers.length > MAX_CARRIED_FILE_REFERRERS
                ? {
                    referrerCount: input.referrers.length,
                  }
                : {}),
            }
          : {}),
      })),
      build = (input: Storage.DatabaseRecord, options: number) =>
        carried.length === 0
          ? {
              ...input,
            }
          : {
              ...input,
              carried: records.slice(0, options),
              ...(carried.length > options
                ? {
                    carriedMore: carried.length - options,
                  }
                : {}),
            },
      maxCount: number = Math.min(
        carried.length,
        runtime.MAX_CARRIED_FILES_METADATA,
      ),
      compactBase = base,
      withCarried = build(compactBase, maxCount);
    if (
      (0, runtime.estimateEmbeddedJsonBytes)(withCarried) >
      runtime.MAX_SYNC_DOCUMENT_BYTES
    ) {
      let { sections: value, ...value2 } = base;
      compactBase = {
        ...value2,
        ...(base.assetGroups !== undefined
          ? {
              assetGroups: (
                base.assetGroups as Storage.StoredPriorityGroup[]
              ).map((input) => ({
                name: input.name,
                ...(input.tile !== undefined
                  ? {
                      tile: input.tile,
                    }
                  : {}),
              })),
            }
          : {}),
      };
      withCarried = build(compactBase, maxCount);
    }
    for (
      let value: number = maxCount;
      (0, runtime.estimateEmbeddedJsonBytes)(withCarried) >
        runtime.MAX_SYNC_DOCUMENT_BYTES && value > 0;

    ) {
      value = Math.floor(value / 2);
      withCarried = build(compactBase, value);
    }
    return withCarried;
  }
  function documentCollectionPath(documentPath: string): string {
    return documentPath.slice(0, documentPath.lastIndexOf("/"));
  }
  bindRuntimeValue(
    runtime,
    "planSystemStoreConversion",
    () => planSystemStoreConversion,
  );
  bindRuntimeValue(
    runtime,
    "applyKnownConversionUploads",
    () => applyKnownConversionUploads,
  );
  bindRuntimeValue(
    runtime,
    "conversionFileReferrers",
    () => conversionFileReferrers,
  );
  bindRuntimeValue(
    runtime,
    "conversionFilePriority",
    () => conversionFilePriority,
  );
  bindRuntimeValue(
    runtime,
    "collectionOverflowConversionMessage",
    () => collectionOverflowConversionMessage,
    (value) => {
      collectionOverflowConversionMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectionFileOverflowMessage",
    () => collectionFileOverflowMessage,
    (value) => {
      collectionFileOverflowMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOB_FILE_COUNT_OVERFLOW_MESSAGE",
    () => BLOB_FILE_COUNT_OVERFLOW_MESSAGE,
    (value) => {
      BLOB_FILE_COUNT_OVERFLOW_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CARRIED_FILE_REFERRERS",
    () => MAX_CARRIED_FILE_REFERRERS,
    (value) => {
      MAX_CARRIED_FILE_REFERRERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "enforceConversionBudgets",
    () => enforceConversionBudgets,
  );
  bindRuntimeValue(
    runtime,
    "metadataWithCarriedFiles",
    () => metadataWithCarriedFiles,
  );
  bindRuntimeValue(
    runtime,
    "documentCollectionPath",
    () => documentCollectionPath,
  );
  return () => {
    collectionOverflowConversionMessage = (input): string =>
      input +
      "/ holds more than " +
      (0, runtime.formatStoredFileKilobytes)(
        runtime.MAX_SYNC_COLLECTION_BYTES,
      ) +
      " of text, so it is stored as a file";
    collectionFileOverflowMessage = (input): string =>
      input +
      "/ is past the " +
      String(runtime.MAX_FILES_PER_COLLECTION) +
      " files one area holds, so it was left out of the store";
    BLOB_FILE_COUNT_OVERFLOW_MESSAGE =
      "the design system is past the " +
      String(runtime.BLOB_STORAGE_LIMITS.files) +
      " stored files it can hold, so it was left out of the store";
    MAX_CARRIED_FILE_REFERRERS = 5;
  };
}
