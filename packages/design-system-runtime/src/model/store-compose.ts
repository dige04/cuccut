import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelStoreCompose(runtime: RuntimeBindings): () => void {
  var stringOrUndefined: (input: unknown) => string | undefined;
  var isStoredDocumentObject: (
    input: unknown,
  ) => input is Storage.DatabaseRecord;
  var REMOTE_FILE_MIME_TYPE_PATTERN: RegExp;
  var REMOTE_FILE_SHA256_PATTERN: RegExp;
  var safeBoundedRemoteFileText: (
    input: unknown,
    length: number,
  ) => string | undefined;
  var EXTERNAL_URL_SCHEME_PATTERN: RegExp;
  var HTML_FILE_REFERENCE_PATTERN: RegExp;
  var CSS_FILE_REFERENCE_PATTERN: RegExp;
  var MARKDOWN_IMAGE_REFERENCE_PATTERN: RegExp;
  var sanitizeStoredReadmeCell: (input: string) => string;
  var STORED_README_CODE_DELIMITER: string;
  var storedReadmeCodeSpan: (input: string) => string;
  var STORED_FILES_GUIDANCE_HEADING: string;
  function parseRemoteFileRecord(
    path: string,
    input: Storage.DatabaseRecord,
  ): Storage.RemoteFileRecord | null {
    let id = (0, runtime.blobIdFromReference)(
      stringOrUndefined(input.dataRef) ?? "",
    );
    if (id === null || (0, runtime.isPendingBlobId)(id)) {
      return null;
    }
    let contentType = stringOrUndefined(input.contentType),
      sha2562 = stringOrUndefined(input.sha256),
      storedSha256 = stringOrUndefined(input.storedSha256);
    return (0, runtime.makeRemoteFileRecord)(
      path,
      (0, runtime.blobAbsoluteUrl)(id),
      {
        bytes:
          typeof input.dataBytes === "number" && input.dataBytes >= 0
            ? Math.floor(input.dataBytes)
            : 0,
        contentType:
          contentType !== undefined &&
          REMOTE_FILE_MIME_TYPE_PATTERN.test(contentType)
            ? contentType
            : undefined,
        sha256:
          sha2562 !== undefined && REMOTE_FILE_SHA256_PATTERN.test(sha2562)
            ? sha2562.toLowerCase()
            : undefined,
        storedSha256:
          storedSha256 !== undefined &&
          REMOTE_FILE_SHA256_PATTERN.test(storedSha256)
            ? storedSha256.toLowerCase()
            : undefined,
        name: safeBoundedRemoteFileText(input.name, 200),
        addedAt: safeBoundedRemoteFileText(input.addedAt, 40),
        via: safeBoundedRemoteFileText(input.via, 120),
      },
    );
  }
  function storageRecordFromRemoteFile(
    remoteRecord: Storage.RemoteFileRecord,
  ): Model.StorageRecord {
    let storageRecord: Model.StorageRecord = {
      store: "blob",
      id: (0, runtime.blobIdFromReference)(remoteRecord.dataRef)!,
      bytes: remoteRecord.dataBytes,
      type:
        remoteRecord.contentType ??
        (0, runtime.mimeTypeForPath)(remoteRecord.path),
    };
    if (remoteRecord.sha256 !== undefined) {
      storageRecord.sha256 = remoteRecord.sha256;
    }
    if (remoteRecord.storedSha256 !== undefined) {
      storageRecord.storedSha256 = remoteRecord.storedSha256;
    }
    if (remoteRecord.name !== undefined) {
      storageRecord.name = remoteRecord.name;
    }
    if (remoteRecord.addedAt !== undefined) {
      storageRecord.addedAt = remoteRecord.addedAt;
    }
    if (remoteRecord.via !== undefined) {
      storageRecord.via = remoteRecord.via;
    }
    return storageRecord;
  }
  function parseStoredSystemMetadata(
    input: unknown,
  ): Storage.StoredSystemMetadata | null {
    if (input === undefined || !isStoredDocumentObject(input)) {
      return null;
    }
    let metadata: Storage.StoredSystemMetadata = {
      v: 1,
      title: stringOrUndefined(input.title) ?? "",
    };
    if (
      typeof input.namespace === "string" &&
      runtime.WINDOW_NAMESPACE_PATTERN.test(input.namespace)
    ) {
      metadata.namespace = input.namespace;
    }
    if (Array.isArray(input.libraries)) {
      metadata.libraries = input.libraries;
    }
    if (Array.isArray(input.assetGroups)) {
      metadata.assetGroups = input.assetGroups;
    }
    if (isStoredDocumentObject(input.sections)) {
      metadata.sections = input.sections;
    }
    if (isStoredDocumentObject(input.lastChange)) {
      metadata.lastChange = input.lastChange;
    }
    if (
      isStoredDocumentObject(input.convertedFrom) &&
      typeof input.convertedFrom.at === "string"
    ) {
      metadata.convertedFrom = input.convertedFrom as Storage.TimestampMetadata;
    }
    if (
      isStoredDocumentObject(input.snapshot) &&
      typeof input.snapshot.at === "string"
    ) {
      metadata.snapshot = input.snapshot as Storage.TimestampMetadata;
    }
    if (Array.isArray(input.carried)) {
      metadata.carried = input.carried
        .slice(0, runtime.MAX_CARRIED_FILES_METADATA)
        .flatMap((input2: unknown): Storage.CarriedFile[] => {
          if (!isStoredDocumentObject(input2)) {
            return [];
          }
          let value = safeBoundedRemoteFileText(input2.path, 300),
            value2 = safeBoundedRemoteFileText(input2.reason, 400);
          if (
            value === undefined ||
            value2 === undefined ||
            typeof input2.form !== "string" ||
            !runtime.CARRIED_FILE_FORMS.includes(
              input2.form as Storage.CarriedForm,
            )
          ) {
            return [];
          }
          return [
            {
              path: value,
              reason: value2,
              form: input2.form as Storage.CarriedForm,
              ...(Array.isArray(input2.referrers)
                ? {
                    referrers: input2.referrers
                      .map((input3: unknown) =>
                        safeBoundedRemoteFileText(input3, 300),
                      )
                      .filter(
                        (input3: string | undefined): input3 is string =>
                          input3 !== undefined,
                      )
                      .slice(0, runtime.MAX_CARRIED_FILE_REFERRERS),
                  }
                : {}),
            },
          ];
        });
    }
    if (typeof input.carriedMore === "number" && input.carriedMore > 0) {
      metadata.carriedMore = Math.floor(input.carriedMore);
    }
    return metadata;
  }
  function composeStoredSystemFiles(
    documents: ReadonlyMap<string, Storage.DatabaseRecord>,
  ): Storage.StoredSystemFiles {
    let meta = parseStoredSystemMetadata(
        documents.get(runtime.SYSTEM_META_DOCUMENT_PATH),
      ),
      title = meta?.title ?? "",
      files: Record<string, string> = {},
      storageFiles: Record<string, Model.StorageRecord> = {},
      remoteText = new Map<string, Storage.RemoteFileRecord>(),
      hidden: number = 0;
    for (let [value, value2] of documents) {
      if (
        value === runtime.SYSTEM_META_DOCUMENT_PATH ||
        value === runtime.SYSTEM_SOURCE_DOCUMENT_PATH ||
        value === runtime.SYSTEM_UPGRADED_DOCUMENT_PATH ||
        !runtime.DESIGN_SYSTEM_COLLECTIONS.includes(
          (0, runtime.documentCollectionPath)(value),
        )
      ) {
        continue;
      }
      if (!isStoredDocumentObject(value2)) {
        hidden++;
        continue;
      }
      let value3 = (0, runtime.validatedFilePathForDocument)(value, value2);
      if (value3 === null) {
        hidden++;
        continue;
      }
      if (
        value3 === runtime.GENERATED_TOKENS_CSS_PATH ||
        (0, runtime.isGeneratedApiPath)(value3)
      ) {
        continue;
      }
      let value4 =
        stringOrUndefined(value2.dataRef) !== undefined
          ? parseRemoteFileRecord(value3, value2)
          : null;
      if (value === runtime.SYSTEM_TOKENS_DOCUMENT_PATH) {
        files[value3] =
          JSON.stringify(value2, null, 2) +
          `
`;
      } else if (
        value3 === runtime.DESIGN_SYSTEM_PATHS.tokens &&
        Object.hasOwn(files, value3)
      ) {
        continue;
      } else if (value4 !== null && (0, runtime.canUseStoragePointer)(value3)) {
        files[value3] = (0, runtime.blobPointer)(
          (0, runtime.blobIdFromReference)(value4.dataRef)!,
        );
        storageFiles[value3] = storageRecordFromRemoteFile(value4);
      } else if (value4 !== null) {
        remoteText.set(value3, value4);
      } else if (typeof value2.data === "string") {
        files[value3] =
          value3 === runtime.DESIGN_SYSTEM_PATHS.readme
            ? (0, runtime.stripGeneratedReadmeTail)(value2.data)
            : value2.data;
      } else {
        hidden++;
      }
    }
    let serializedStorage = (0, runtime.serializeStorageCatalog)({
      files: storageFiles,
    });
    files[runtime.DESIGN_SYSTEM_PATHS.manifest] = (0,
    runtime.stringifyManifestWithinBudget)({
      manifestVersion: 3,
      name: title,
      namespace: meta?.namespace ?? null,
      ...(meta?.libraries !== undefined
        ? {
            libraries: meta.libraries,
          }
        : {}),
      ...(meta?.lastChange !== undefined
        ? {
            lastChange: meta.lastChange,
          }
        : {}),
      assetGroups: meta?.assetGroups ?? [],
      ...(serializedStorage !== undefined
        ? {
            storage: serializedStorage,
          }
        : {}),
      ...(meta?.sections !== undefined
        ? {
            sections: meta.sections,
          }
        : {}),
    });
    files[runtime.DESIGN_SYSTEM_PATHS.manifest] = (0,
    runtime.stringifyManifestWithinBudget)(
      (0, runtime.buildDesignSystemManifest)(
        (0, runtime.parsedDesignSystem)({
          v: 2,
          files: {
            ...files,
          },
        }),
        title,
      ),
    );
    let sortedFiles = Object.fromEntries(
        Object.keys(files)
          .sort()
          .map((input: string): [string, string] => [input, files[input]]),
      ),
      source = documents.get(runtime.SYSTEM_SOURCE_DOCUMENT_PATH),
      upgraded = documents.get(runtime.SYSTEM_UPGRADED_DOCUMENT_PATH);
    return {
      title: title,
      files: Object.freeze(sortedFiles),
      remoteText: remoteText,
      meta: meta,
      source: isStoredDocumentObject(source) ? source : null,
      upgraded: isStoredDocumentObject(upgraded) ? upgraded : null,
      hidden: hidden,
    };
  }
  function hydrateStoredSystemText(
    system: Storage.StoredSystemFiles,
    remoteText: ReadonlyMap<string, string>,
  ): Model.FileTable {
    let files = {
      ...system.files,
    };
    for (let [value, value2] of remoteText) {
      if (system.remoteText.has(value)) {
        files[value] =
          value === runtime.DESIGN_SYSTEM_PATHS.readme
            ? (0, runtime.stripGeneratedReadmeTail)(value2)
            : value2;
      }
    }
    files[runtime.DESIGN_SYSTEM_PATHS.manifest] = (0,
    runtime.stringifyManifestWithinBudget)(
      (0, runtime.buildDesignSystemManifest)(
        (0, runtime.parsedDesignSystem)({
          v: 2,
          files: {
            ...files,
          },
        }),
        system.title,
      ),
    );
    return Object.freeze(
      Object.fromEntries(
        Object.keys(files)
          .sort()
          .map((input: string): [string, string] => [input, files[input]]),
      ),
    );
  }
  function isLocalFileReference(reference: string): boolean {
    let trimmed = reference.trim();
    return (
      trimmed !== "" &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("#") &&
      !EXTERNAL_URL_SCHEME_PATTERN.test(trimmed)
    );
  }
  function normalizeLocalFileReference(reference: string): string | null {
    if (!isLocalFileReference(reference)) {
      return null;
    }
    let path = reference.trim().replace(/[?#].*$/, "");
    try {
      path = decodeURIComponent(path);
    } catch {}
    if (
      isLocalFileReference(path) &&
      path.split("/").some((input: string) => input !== "" && input !== ".")
    ) {
      return path;
    } else {
      return null;
    }
  }
  function resolveLocalFileReference(
    sourcePath: string,
    reference: string,
  ): string | null {
    let localPath = normalizeLocalFileReference(reference);
    if (localPath === null) {
      return null;
    }
    let segments =
      localPath.startsWith("/") || (0, runtime.pathDirname)(sourcePath) === ""
        ? []
        : (0, runtime.pathDirname)(sourcePath).split("/");
    for (let value of localPath.split("/")) {
      if (value === "" || value === ".") {
        continue;
      }
      if (value === "..") {
        if (segments.length === 0) {
          return null;
        }
        segments.pop();
      } else {
        segments.push(value);
      }
    }
    let path = segments.join("/");
    if ((0, runtime.isValidDesignSystemPath)(path)) {
      return (0, runtime.normalizeDesignSystemPath)(path);
    } else {
      return null;
    }
  }
  function componentFileReferences(path: string, content: string): string[] {
    let references: string[] = [],
      kind = (0, runtime.classifyDesignSystemFile)(path);
    if (kind !== "preview" && kind !== "componentReadme") {
      return references;
    }
    let addReference = (input: RegExpMatchArray): void => {
      let value = (input[1] ?? input[2] ?? input[3] ?? "").trim();
      if (
        normalizeLocalFileReference(value) !== null &&
        !references.includes(value)
      ) {
        references.push(value);
      }
    };
    if (kind === "componentReadme") {
      for (let value of content.matchAll(MARKDOWN_IMAGE_REFERENCE_PATTERN)) {
        addReference(value);
      }
    }
    for (let value of content.matchAll(HTML_FILE_REFERENCE_PATTERN)) {
      addReference(value);
    }
    for (let value of content.matchAll(CSS_FILE_REFERENCE_PATTERN)) {
      addReference(value);
    }
    return references;
  }
  function remoteFileRecordAtPath(
    documents: ReadonlyMap<string, Storage.DatabaseRecord>,
    path: string,
  ): Storage.RemoteFileRecord | null {
    let record = documents.get((0, runtime.documentPathForFile)(path));
    if (record === undefined) {
      return null;
    } else {
      return parseRemoteFileRecord(path, record);
    }
  }
  function generateStoredFilesGuidance(
    documents: ReadonlyMap<string, Storage.DatabaseRecord>,
  ): string {
    let idsInCollection = (items: string) =>
        [...documents.keys()]
          .filter(
            (input: string): boolean =>
              (0, runtime.documentCollectionPath)(input) === items,
          )
          .map((input: string) => input.slice(items.length + 1))
          .sort(),
      blobIdForPath = (input: string) =>
        (0, runtime.blobIdFromReference)(
          remoteFileRecordAtPath(documents, input)?.dataRef ?? "",
        ),
      rawTokensRecord = documents.get(runtime.RAW_TOKENS_DOCUMENT_PATH),
      rawTokensId =
        rawTokensRecord === undefined
          ? null
          : (0, runtime.blobIdFromReference)(
              parseRemoteFileRecord(
                runtime.DESIGN_SYSTEM_PATHS.tokens,
                rawTokensRecord,
              )?.dataRef ?? "",
            ),
      rows: string[] = [];
    if (blobIdForPath(runtime.DESIGN_SYSTEM_PATHS.readme) !== null) {
      rows.push(
        "| " +
          storedReadmeCodeSpan(runtime.DESIGN_SYSTEM_PATHS.readme) +
          " (this README, too large for a document) | " +
          storedReadmeCodeSpan(
            blobIdForPath(runtime.DESIGN_SYSTEM_PATHS.readme)!,
          ) +
          " |",
      );
    }
    if (rawTokensId !== null) {
      rows.push(
        "| " +
          storedReadmeCodeSpan(runtime.DESIGN_SYSTEM_PATHS.tokens) +
          " (too large for a document) | " +
          storedReadmeCodeSpan(rawTokensId) +
          " |",
      );
    }
    for (let value of [
      runtime.DESIGN_SYSTEM_PATHS.bundleJs,
      runtime.DESIGN_SYSTEM_PATHS.bundleCss,
      runtime.DESIGN_SYSTEM_PATHS.indexDts,
    ]) {
      if (blobIdForPath(value) !== null) {
        rows.push(
          "| " +
            storedReadmeCodeSpan(value) +
            " | " +
            storedReadmeCodeSpan(blobIdForPath(value)!) +
            " |",
        );
      }
    }
    for (let value of idsInCollection(runtime.COMPONENTS_COLLECTION)
      .map(
        (input: string) =>
          stringOrUndefined(
            documents.get(runtime.COMPONENTS_COLLECTION + "/" + input)?.path,
          ) ?? "",
      )
      .filter((input: string) =>
        input.startsWith(runtime.DESIGN_SYSTEM_PATHS.libDir),
      )
      .sort()) {
      if (blobIdForPath(value) !== null) {
        rows.push(
          "| " +
            storedReadmeCodeSpan(value) +
            " (load before the bundle) | " +
            storedReadmeCodeSpan(blobIdForPath(value)!) +
            " |",
        );
      }
    }
    let tokensRecord = documents.get(runtime.SYSTEM_TOKENS_DOCUMENT_PATH),
      fonts =
        tokensRecord === undefined
          ? []
          : (0, runtime.parseTokens)(tokensRecord).type.fonts;
    for (let value of idsInCollection(runtime.FONTS_COLLECTION)) {
      let value2 =
        stringOrUndefined(
          documents.get(runtime.FONTS_COLLECTION + "/" + value)?.path,
        ) ?? "";
      if (blobIdForPath(value2) === null) {
        continue;
      }
      let value3 = fonts.find(
        (input: Model.FontFace): boolean => input.file === value2,
      );
      rows.push(
        "| " +
          (value3 !== undefined
            ? sanitizeStoredReadmeCell(
                value3.family +
                  (value3.style !== "normal" ? " " + value3.style : ""),
              ) + " — "
            : "") +
          storedReadmeCodeSpan(value2) +
          " | " +
          storedReadmeCodeSpan(blobIdForPath(value2)!) +
          " |",
      );
    }
    let tokensLocation: string | string | null =
        tokensRecord !== undefined
          ? storedReadmeCodeSpan(runtime.DESIGN_SYSTEM_PATHS.tokens) +
            " is " +
            storedReadmeCodeSpan(runtime.SYSTEM_COLLECTION) +
            " / " +
            storedReadmeCodeSpan(runtime.TOKENS_DOCUMENT_ID) +
            " (the object itself; to hand it to a tool as a file, " +
            storedReadmeCodeSpan("get") +
            " it with " +
            storedReadmeCodeSpan("out_dir") +
            " set to this artifact’s folder in your scratchpad — it lands there as " +
            storedReadmeCodeSpan(
              runtime.SYSTEM_COLLECTION +
                "/" +
                runtime.TOKENS_DOCUMENT_ID +
                ".json",
            ) +
            ")"
          : rawTokensRecord !== undefined && rawTokensId === null
            ? storedReadmeCodeSpan(runtime.DESIGN_SYSTEM_PATHS.tokens) +
              " did not parse as JSON, so only its raw text is kept, at " +
              storedReadmeCodeSpan(runtime.FILES_COLLECTION) +
              " / " +
              storedReadmeCodeSpan(
                (0, runtime.encodeDocumentId)(
                  runtime.DESIGN_SYSTEM_PATHS.tokens,
                ),
              )
            : null,
      guidance = [
        STORED_FILES_GUIDANCE_HEADING +
          " each file this README names is one document on this same url — the " +
          storedReadmeCodeSpan("ArtifactData") +
          " tool’s " +
          storedReadmeCodeSpan("get") +
          ", or " +
          storedReadmeCodeSpan("list") +
          " for a whole collection (or " +
          storedReadmeCodeSpan("read_db") +
          " on an " +
          storedReadmeCodeSpan("Artifact") +
          " tool that still lists it). A path’s first folder is its collection — " +
          [
            runtime.COMPONENTS_COLLECTION,
            runtime.ASSETS_COLLECTION,
            runtime.FONTS_COLLECTION,
          ]
            .map(storedReadmeCodeSpan)
            .join(", ") +
          ", and " +
          storedReadmeCodeSpan(runtime.API_COLLECTION) +
          " for the generated cards the Index lists; a component’s " +
          storedReadmeCodeSpan("preview.html") +
          " is in " +
          storedReadmeCodeSpan(runtime.PREVIEWS_COLLECTION) +
          " under the component’s name — and every other path (this README, further sections, " +
          storedReadmeCodeSpan(runtime.GENERATED_TOKENS_CSS_PATH) +
          ") is in " +
          storedReadmeCodeSpan(runtime.FILES_COLLECTION) +
          ". The " +
          storedReadmeCodeSpan("doc_id") +
          " is the path without that collection folder (the whole path in " +
          storedReadmeCodeSpan(runtime.FILES_COLLECTION) +
          '), each "/" written ' +
          storedReadmeCodeSpan("~2f") +
          " (any other byte outside A–Z a–z 0–9 _ . - likewise, " +
          storedReadmeCodeSpan("~") +
          " and two hex digits: a space is " +
          storedReadmeCodeSpan("~20") +
          ") — so " +
          storedReadmeCodeSpan(
            runtime.API_COLLECTION + "/components/Button.md",
          ) +
          " is " +
          storedReadmeCodeSpan(runtime.API_COLLECTION) +
          " / " +
          storedReadmeCodeSpan("components~2fButton.md") +
          " and this README is " +
          storedReadmeCodeSpan(runtime.FILES_COLLECTION) +
          " / " +
          storedReadmeCodeSpan(
            (0, runtime.encodeDocumentId)(runtime.DESIGN_SYSTEM_PATHS.readme),
          ) +
          (tokensLocation !== null ? "; " + tokensLocation : "") +
          ". Not found? " +
          storedReadmeCodeSpan("list") +
          ' that collection. A document with "dataRef" in place of "data" is a stored file: the ' +
          storedReadmeCodeSpan("Artifact") +
          " tool’s " +
          storedReadmeCodeSpan("read") +
          ' with the id after "/_blob/" as ' +
          storedReadmeCodeSpan("path") +
          " (" +
          storedReadmeCodeSpan("read_asset") +
          " on a tool that still lists it)" +
          (rows.length > 0
            ? '; this system’s own are below, as of this README’s last refresh — where a document’s "dataRef" differs, the document is right.'
            : "."),
      ];
    if (rows.length > 0) {
      guidance.push("", "| stored file | id |", "| --- | --- |", ...rows);
    }
    return guidance.join(`
`);
  }
  function appendStoredFilesGuidance(
    plan: Storage.ConversionPlan,
  ): Storage.ConversionPlan {
    let readmePath = (0, runtime.documentPathForFile)(
        runtime.DESIGN_SYSTEM_PATHS.readme,
      ),
      record = plan.docs.get(readmePath);
    if (record === undefined || typeof record.data !== "string") {
      return plan;
    }
    let generatedOffset = (0, runtime.generatedReadmeTailOffset)(record.data);
    if (generatedOffset < 0) {
      return plan;
    }
    let guidanceOffset = record.data.indexOf(
        `
` + STORED_FILES_GUIDANCE_HEADING,
        generatedOffset,
      ),
      withoutGuidance =
        guidanceOffset < 0 ? record.data : record.data.slice(0, guidanceOffset),
      updatedRecord = {
        ...record,
        data:
          withoutGuidance.trimEnd() +
          `

` +
          generateStoredFilesGuidance(plan.docs) +
          `
`,
      },
      collectionBytes =
        512 *
        plan.uploads
          .flatMap((input) => input.paths)
          .filter(
            (input: string): boolean =>
              (0, runtime.documentCollectionPath)(
                (0, runtime.rawDocumentPathForFile)(input),
              ) === runtime.FILES_COLLECTION,
          ).length;
    for (let [value, value2] of plan.docs) {
      if (
        (0, runtime.documentCollectionPath)(value) === runtime.FILES_COLLECTION
      ) {
        collectionBytes += (0, runtime.estimateEmbeddedJsonBytes)(
          value === readmePath ? updatedRecord : value2,
        );
      }
    }
    if (
      (0, runtime.estimateEmbeddedJsonBytes)(updatedRecord) >
        runtime.MAX_SYNC_DOCUMENT_BYTES ||
      collectionBytes > runtime.MAX_SYNC_COLLECTION_BYTES
    ) {
      if (guidanceOffset < 0) {
        return plan;
      }
      updatedRecord = {
        ...record,
        data: withoutGuidance,
      };
    }
    let documents = new Map(plan.docs);
    documents.set(readmePath, updatedRecord);
    return {
      ...plan,
      docs: documents,
    };
  }
  bindRuntimeValue(
    runtime,
    "stringOrUndefined",
    () => stringOrUndefined,
    (value) => {
      stringOrUndefined = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isStoredDocumentObject",
    () => isStoredDocumentObject,
    (value) => {
      isStoredDocumentObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REMOTE_FILE_MIME_TYPE_PATTERN",
    () => REMOTE_FILE_MIME_TYPE_PATTERN,
    (value) => {
      REMOTE_FILE_MIME_TYPE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REMOTE_FILE_SHA256_PATTERN",
    () => REMOTE_FILE_SHA256_PATTERN,
    (value) => {
      REMOTE_FILE_SHA256_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "safeBoundedRemoteFileText",
    () => safeBoundedRemoteFileText,
    (value) => {
      safeBoundedRemoteFileText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseRemoteFileRecord",
    () => parseRemoteFileRecord,
  );
  bindRuntimeValue(
    runtime,
    "storageRecordFromRemoteFile",
    () => storageRecordFromRemoteFile,
  );
  bindRuntimeValue(
    runtime,
    "parseStoredSystemMetadata",
    () => parseStoredSystemMetadata,
  );
  bindRuntimeValue(
    runtime,
    "composeStoredSystemFiles",
    () => composeStoredSystemFiles,
  );
  bindRuntimeValue(
    runtime,
    "hydrateStoredSystemText",
    () => hydrateStoredSystemText,
  );
  bindRuntimeValue(
    runtime,
    "EXTERNAL_URL_SCHEME_PATTERN",
    () => EXTERNAL_URL_SCHEME_PATTERN,
    (value) => {
      EXTERNAL_URL_SCHEME_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "isLocalFileReference", () => isLocalFileReference);
  bindRuntimeValue(
    runtime,
    "normalizeLocalFileReference",
    () => normalizeLocalFileReference,
  );
  bindRuntimeValue(
    runtime,
    "resolveLocalFileReference",
    () => resolveLocalFileReference,
  );
  bindRuntimeValue(
    runtime,
    "HTML_FILE_REFERENCE_PATTERN",
    () => HTML_FILE_REFERENCE_PATTERN,
    (value) => {
      HTML_FILE_REFERENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_FILE_REFERENCE_PATTERN",
    () => CSS_FILE_REFERENCE_PATTERN,
    (value) => {
      CSS_FILE_REFERENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MARKDOWN_IMAGE_REFERENCE_PATTERN",
    () => MARKDOWN_IMAGE_REFERENCE_PATTERN,
    (value) => {
      MARKDOWN_IMAGE_REFERENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "componentFileReferences",
    () => componentFileReferences,
  );
  bindRuntimeValue(
    runtime,
    "remoteFileRecordAtPath",
    () => remoteFileRecordAtPath,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeStoredReadmeCell",
    () => sanitizeStoredReadmeCell,
    (value) => {
      sanitizeStoredReadmeCell = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORED_README_CODE_DELIMITER",
    () => STORED_README_CODE_DELIMITER,
    (value) => {
      STORED_README_CODE_DELIMITER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "storedReadmeCodeSpan",
    () => storedReadmeCodeSpan,
    (value) => {
      storedReadmeCodeSpan = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORED_FILES_GUIDANCE_HEADING",
    () => STORED_FILES_GUIDANCE_HEADING,
    (value) => {
      STORED_FILES_GUIDANCE_HEADING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "generateStoredFilesGuidance",
    () => generateStoredFilesGuidance,
  );
  bindRuntimeValue(
    runtime,
    "appendStoredFilesGuidance",
    () => appendStoredFilesGuidance,
  );
  return () => {
    stringOrUndefined = (input: unknown) =>
      typeof input === "string" ? input : undefined;
    isStoredDocumentObject = (
      input: unknown,
    ): input is Storage.DatabaseRecord =>
      typeof input === "object" && input !== null && !Array.isArray(input);
    REMOTE_FILE_MIME_TYPE_PATTERN =
      /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;
    REMOTE_FILE_SHA256_PATTERN = /^[0-9a-f]{64}$/i;
    safeBoundedRemoteFileText = (items: unknown, options: number) =>
      typeof items === "string" &&
      items.length <= options &&
      !/[\u0000-\u001f\u007f]/.test(items)
        ? items
        : undefined;
    EXTERNAL_URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
    HTML_FILE_REFERENCE_PATTERN =
      /\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    CSS_FILE_REFERENCE_PATTERN =
      /(?:^|[\s:,(])url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/g;
    MARKDOWN_IMAGE_REFERENCE_PATTERN =
      /!\[[^\]]*\]\(\s*<?([^)>\s]+)>?(?:\s+"[^"]*")?\s*\)/g;
    sanitizeStoredReadmeCell = (input: string) =>
      input.replace(/[|\r\n]+/g, " ").trim();
    STORED_README_CODE_DELIMITER = "`";
    storedReadmeCodeSpan = (input: string): string =>
      STORED_README_CODE_DELIMITER +
      sanitizeStoredReadmeCell(input).replaceAll(
        STORED_README_CODE_DELIMITER,
        "",
      ) +
      STORED_README_CODE_DELIMITER;
    STORED_FILES_GUIDANCE_HEADING =
      "**Where these live (this artifact’s store):**";
  };
}
