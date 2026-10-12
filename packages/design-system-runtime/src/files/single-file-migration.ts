/** Restored application module; prepare first, initialize in original order. */
import type * as Migration from "../contracts/migration";
import type * as Model from "../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesSingleFileMigration(
  runtime: RuntimeBindings & Migration.MigrationRuntime,
): () => void {
  var OLDER_SINGLE_FILE_COPY_MESSAGE: string;
  var SINGLE_FILE_MIGRATION_BACKUP_PATH: string;
  var SINGLE_FILE_REPLACEMENT_CHARACTER: string;
  var SINGLE_FILE_SYNTHETIC_META_FIELD: string;
  var SINGLE_FILE_MIGRATION_PUBLISH_SPACING_MS: number;
  function parseSingleFileDesignSystem(text: string) {
    let parsed = (0, runtime.parseDesignSystemEnvelope)(text);
    if (typeof parsed === "string") {
      return null;
    }
    return {
      title:
        typeof parsed.envelope.title === "string" ? parsed.envelope.title : "",
      files: {
        ...(0, runtime.parseDesignSystemContent)(
          parsed.envelope.content,
          undefined,
          {
            unbounded: true,
          },
        ).files,
      },
    };
  }
  function createSingleFileMigrationStore(
    store: Model.FilesMigrationStore,
    readSingleFile: Migration.ReadSingleFile,
  ): Model.FilesMigrationStore {
    let fence: unknown,
      syntheticMeta =
        async (): Promise<Model.FilesMigrationStoreDocument | null> => {
          let [value, value2] = await Promise.all([
            readSingleFile().catch(() => {
              throw Object.assign(Error("upstream_error"), {
                code: "upstream_error",
              });
            }),
            store.get(runtime.SYSTEM_META_DOCUMENT_PATH),
          ]);
          if (value === null) {
            return null;
          } else {
            return {
              path: runtime.SYSTEM_META_DOCUMENT_PATH,
              data: {
                ...(value2?.data ?? {}),
                ...(fence !== undefined && fence !== null
                  ? {
                      [runtime.CONVERTING_MARKER_KEY]: fence,
                    }
                  : {}),
                [SINGLE_FILE_SYNTHETIC_META_FIELD]: {
                  sha256: value.sha256,
                  text: value.text,
                },
              },
            };
          }
        };
    return {
      list: async (
        input: string,
      ): Promise<Model.FilesMigrationStoreDocument[]> => {
        let value =
          input === runtime.SYSTEM_COLLECTION ? await syntheticMeta() : null;
        if (value === null) {
          return [];
        } else {
          return [value];
        }
      },
      get: (input) =>
        input === runtime.SYSTEM_META_DOCUMENT_PATH
          ? syntheticMeta()
          : store.get(input),
      async update(
        input: string,
        options: Record<string, unknown>,
      ): Promise<void> {
        if (input !== runtime.SYSTEM_META_DOCUMENT_PATH) {
          return store.update(input, options);
        }
        let { [runtime.CONVERTING_MARKER_KEY]: value, ...value2 } = options;
        if (Object.hasOwn(options, runtime.CONVERTING_MARKER_KEY)) {
          fence = value;
        }
        if (Object.keys(value2).length === 0) {
          return;
        }
        try {
          await store.update(input, value2);
        } catch (value3) {
          if (store.set === undefined || (await store.get(input)) !== null) {
            throw value3;
          }
          await store.set!(input, value2);
        }
      },
      ...(store.set !== undefined
        ? {
            set: (input, options) => store.set!(input, options),
          }
        : {}),
      acquire: (input, options) => store.acquire(input, options),
    };
  }
  function createSingleFileMigrationAdapter(
    fetchBlob: Migration.FetchMigrationBlob,
  ): Migration.SingleFileMigrationAdapter {
    let builtFromSha: string | undefined,
      builtPaths = new Set<string>(),
      codec: Migration.MigrationCodec = {
        async toTree(
          input: Migration.StoreSnapshot,
          options?: { preflight?: boolean },
        ): Promise<Migration.MigrationTree> {
          let value = input.get(runtime.SYSTEM_META_DOCUMENT_PATH)?.data[
              SINGLE_FILE_SYNTHETIC_META_FIELD
            ] as { text?: unknown; sha256?: unknown } | undefined,
            value2 =
              typeof value?.text === "string"
                ? parseSingleFileDesignSystem(value.text)
                : null;
          if (value2 === null || typeof value?.sha256 !== "string") {
            throw new runtime.DesignSystemMigrationError("invalid_content");
          }
          let value3 = (0, runtime.designSystemFilesMigrationTree)(
            {
              title: value2.title,
              files: await (0, runtime.materializeMigrationBlobFiles)(
                value2.files,
                value2.title,
                fetchBlob,
              ),
              source: null,
              upgraded: null,
            },
            () => [runtime.SYSTEM_META_DOCUMENT_PATH],
          );
          if (options?.preflight !== true) {
            builtFromSha = value.sha256;
            builtPaths = new Set(value3.files.keys());
          }
          return value3;
        },
        serializeIndex: runtime.serializeMigrationIndex,
        fold: (input) => ({
          files: new Map(),
          index: input.index,
          sources: new Map(),
        }),
      };
    return {
      adapter: {
        type: "design_system",
        indexPath: runtime.FILES_INDEX_PROJECT_PATH,
        metaPath: runtime.SYSTEM_META_DOCUMENT_PATH,
        lockPath: runtime.DESIGN_SYSTEM_MIGRATION_LOCK_PATH,
        allowlist: [
          {
            collection: runtime.SYSTEM_COLLECTION,
            docId: runtime.META_DOCUMENT_ID,
          },
        ],
        dbRules: (0, runtime.designSystemMigrationDbRules)(),
        codec: codec,
        home: "file",
        kept: () =>
          builtFromSha !== undefined
            ? {
                [SINGLE_FILE_MIGRATION_BACKUP_PATH]: {
                  sha256: builtFromSha,
                },
              }
            : {},
        digestView: (input) => ({
          [SINGLE_FILE_SYNTHETIC_META_FIELD]:
            (
              input.data[SINGLE_FILE_SYNTHETIC_META_FIELD] as
                | { sha256?: unknown }
                | undefined
            )?.sha256 ?? null,
        }),
      },
      builtFrom: () => builtFromSha,
      builtPaths: () => builtPaths,
    };
  }
  function createSingleFileMigrationFiles(
    files: Migration.MigrationFilesPort,
    adapter: Migration.SingleFileMigrationAdapter,
    readSingleFile: Migration.ReadSingleFile,
    timers?: Model.FilesTimers,
  ): Migration.MigrationFilesPort {
    let needsCleanup: boolean = true,
      backedUpSha: string | undefined,
      wait = () =>
        timers === undefined
          ? Promise.resolve()
          : new Promise<void>(
              (input) =>
                void timers.setTimeout(
                  input,
                  SINGLE_FILE_MIGRATION_PUBLISH_SPACING_MS,
                ),
            );
    return {
      async list(): Promise<Model.FileListing> {
        let value = (await (0, runtime.listWritableFiles)(files)).filter(
          (input): boolean => !(0, runtime.isProjectContentPath)(input.path),
        );
        if (
          value.some(
            (input): boolean =>
              input.path === SINGLE_FILE_MIGRATION_BACKUP_PATH,
          )
        ) {
          return value;
        }
        let value2 = await readSingleFile().catch((): null => null);
        if (value2 === null) {
          return value;
        } else {
          return [
            ...value,
            {
              path: SINGLE_FILE_MIGRATION_BACKUP_PATH,
              sha256: "",
              size: new TextEncoder().encode(value2.text).length,
              contentType: "application/json",
            },
          ];
        }
      },
      readText: (input) => files.readText(input),
      version: () => files.version(),
      get canWrite() {
        return files.canWrite;
      },
      get narrowed() {
        return files.narrowed;
      },
      get mayWrite() {
        return files.mayWrite;
      },
      async publish(
        input: Model.FilePublishEntries,
      ): Promise<Model.FilePublishResult> {
        if (needsCleanup) {
          let value2: Model.FileListing;
          try {
            value2 = await (0, runtime.listWritableFiles)(files);
          } catch {
            return {
              ok: false,
              code: "upstream_error",
            };
          }
          let value3 = value2
            .map((input2) => input2.path)
            .filter(
              (input2) =>
                (0, runtime.isProjectContentPath)(input2) &&
                !adapter.builtPaths().has(input2) &&
                !Object.hasOwn(input, input2),
            );
          for (let index = 0; index < value3.length; index += 200) {
            let value4 = await files.publish(
              Object.fromEntries(
                value3
                  .slice(index, index + 200)
                  .map((input2) => [input2, null]),
              ),
            );
            if (!value4.ok) {
              return value4;
            }
            await wait();
          }
          needsCleanup = false;
        }
        let value = Object.hasOwn(input, runtime.FILES_INDEX_PROJECT_PATH);
        if (value) {
          let value2 = await readSingleFile().catch((): null => null);
          if (value2 === null) {
            return {
              ok: false,
              code: "upstream_error",
            };
          }
          if (value2.sha256 !== adapter.builtFrom()) {
            return {
              ok: false,
              code: "conflict",
            };
          }
          if (backedUpSha !== value2.sha256) {
            let value3 = await files.publish({
              [SINGLE_FILE_MIGRATION_BACKUP_PATH]: {
                content: value2.text,
                contentType: "application/json",
              },
            });
            if (!value3.ok) {
              return value3;
            }
            backedUpSha = value2.sha256;
            await wait();
          }
        }
        return files.publish(
          value
            ? {
                ...input,
                [runtime.DESIGN_SYSTEM_ENVELOPE_PATH]: null,
              }
            : input,
        );
      },
    };
  }
  async function classifySingleFileMigrationSentinel(
    files: Migration.MigrationFilesPort,
    listing: Model.FileListing,
  ): Promise<string | undefined> {
    if (
      !listing.some(
        (input): boolean => input.path === runtime.MIGRATION_SENTINEL_PATH,
      )
    ) {
      return "none";
    }
    try {
      if (
        (0, runtime.parseMigrationSentinel)(
          (await files.readText(runtime.MIGRATION_SENTINEL_PATH)).text,
        )?.type === "design_system"
      ) {
        return "ours";
      } else {
        return "none";
      }
    } catch {
      return "unread";
    }
  }
  async function preflightSingleFileMigration(options: {
    files: Migration.MigrationFilesPort;
    text: string;
  }): Promise<
    | Migration.MigrationPreflight
    | "not_single_file"
    | "not_now"
    | "moved_before"
  > {
    try {
      let value = parseSingleFileDesignSystem(options.text);
      if (value === null) {
        return "not_single_file";
      }
      let value2: Model.FileListing;
      try {
        value2 = await (0, runtime.listWritableFiles)(options.files);
      } catch {
        return "not_now";
      }
      if ((0, runtime.fileListingIsNarrowed)(value2, options.files)) {
        return "not_now";
      }
      let value3 = await classifySingleFileMigrationSentinel(
        options.files,
        value2,
      );
      if (value3 !== "none") {
        if (value3 === "ours") {
          return "moved_before";
        } else {
          return "not_now";
        }
      }
      if (
        new TextEncoder().encode(options.text).length >
        runtime.MAX_FILE_PUBLISH_ENCODED_BYTES
      ) {
        return "too_large";
      }
      if (options.text.includes(SINGLE_FILE_REPLACEMENT_CHARACTER)) {
        return {
          unpublishable: [
            {
              path: runtime.DESIGN_SYSTEM_ENVELOPE_PATH,
              reason:
                "it holds a character that did not decode (it shows as " +
                SINGLE_FILE_REPLACEMENT_CHARACTER +
                "); find it and type it again",
            },
          ],
        };
      }
      let value4 = (0, runtime.filesLeftOutOfMigration)(value.files);
      if (value4.length > 0) {
        return {
          unpublishable: value4,
        };
      }
      let value5 = (0, runtime.designSystemFilesMigrationTree)(
          {
            title: value.title,
            files: Object.freeze({
              ...value.files,
            }),
            source: null,
            upgraded: null,
          },
          () => [],
        ),
        value6 = (0, runtime.blobFilesOwedToFileStorage)(value.files),
        value7 = (0, runtime.storageCatalogFromManifest)(
          value.files["manifest.json"] ?? "",
        ),
        items = [
          ...value2.filter(
            (input) =>
              !(0, runtime.isProjectContentPath)(input.path) &&
              input.path !== SINGLE_FILE_MIGRATION_BACKUP_PATH,
          ),
          {
            path: SINGLE_FILE_MIGRATION_BACKUP_PATH,
            size: new TextEncoder().encode(options.text).length,
          },
        ],
        value8 = (0, runtime.migrationVersionSize)(
          items,
          value5,
          runtime.FILES_INDEX_PROJECT_PATH,
          (0, runtime.serializeMigrationIndex)(value5.index),
        );
      if (
        value8.oversized.length > 0 ||
        value8.files + value6.length > runtime.ARTIFACT_FILE_CAPACITY.files
      ) {
        return "too_large";
      }
      if (
        value8.bytes +
          value6.reduce(
            (input, options2) =>
              input + (value7.files[options2.path]?.bytes ?? 0),
            0,
          ) >
        runtime.ARTIFACT_FILE_CAPACITY.bytes
      ) {
        return "too_large";
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  async function migrateSingleFileDesignSystem(
    options: Migration.DesignSystemMigrationOptions,
  ): Promise<Migration.MigrationOutcome> {
    let readSingleFile = async (): Promise<Model.FileTextRead> => {
        let value = await options.files.readText(
          runtime.DESIGN_SYSTEM_ENVELOPE_PATH,
        );
        return {
          text: value.text,
          sha256: value.sha256,
        };
      },
      listing: Model.FileListing;
    try {
      listing = await (0, runtime.listWritableFiles)(options.files);
    } catch (value) {
      if (
        (value as { narrowed?: unknown } | null | undefined)?.narrowed === true
      ) {
        return {
          result: "skipped",
          reason: "narrowed_listing",
        };
      } else {
        return {
          result: "aborted",
          stage: "preflight",
          code: "upstream_error",
          ms: 0,
        };
      }
    }
    if ((0, runtime.fileListingIsNarrowed)(listing, options.files)) {
      return {
        result: "skipped",
        reason: "narrowed_listing",
      };
    }
    let sentinelKind = await classifySingleFileMigrationSentinel(
      options.files,
      listing,
    );
    if (sentinelKind === "unread") {
      return {
        result: "aborted",
        stage: "preflight",
        code: "upstream_error",
        ms: 0,
      };
    }
    if (sentinelKind === "ours") {
      return {
        result: "skipped",
        reason: "already_moved",
      };
    }
    let singleFile = await readSingleFile().catch((): null => null);
    if (singleFile === null) {
      return {
        result: "aborted",
        stage: "preflight",
        code: "upstream_error",
        ms: 0,
      };
    }
    if (
      new TextEncoder().encode(singleFile.text).length >
      runtime.MAX_FILE_PUBLISH_ENCODED_BYTES
    ) {
      return {
        result: "skipped",
        reason: "too_large",
      };
    }
    let adapter = createSingleFileMigrationAdapter(options.fetchBlob);
    return (0, runtime.migrateStoreToFiles)({
      adapter: adapter.adapter,
      versionCaps: runtime.ARTIFACT_FILE_CAPACITY,
      files: createSingleFileMigrationFiles(
        options.files,
        adapter,
        readSingleFile,
        options.timers,
      ),
      store: createSingleFileMigrationStore(options.store, readSingleFile),
      holder: options.holder,
      by: options.by,
      timers: options.timers,
      ...(options.artifactId !== undefined
        ? {
            artifactId: options.artifactId,
          }
        : {}),
      sharedExternally: async (): Promise<null> => null,
      embedsArtifacts: async (): Promise<null> => null,
      ...(options.onStage !== undefined
        ? {
            onStage: options.onStage,
          }
        : {}),
    });
  }
  bindRuntimeValue(
    runtime,
    "OLDER_SINGLE_FILE_COPY_MESSAGE",
    () => OLDER_SINGLE_FILE_COPY_MESSAGE,
    (value) => {
      OLDER_SINGLE_FILE_COPY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SINGLE_FILE_MIGRATION_BACKUP_PATH",
    () => SINGLE_FILE_MIGRATION_BACKUP_PATH,
    (value) => {
      SINGLE_FILE_MIGRATION_BACKUP_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SINGLE_FILE_REPLACEMENT_CHARACTER",
    () => SINGLE_FILE_REPLACEMENT_CHARACTER,
    (value) => {
      SINGLE_FILE_REPLACEMENT_CHARACTER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SINGLE_FILE_SYNTHETIC_META_FIELD",
    () => SINGLE_FILE_SYNTHETIC_META_FIELD,
    (value) => {
      SINGLE_FILE_SYNTHETIC_META_FIELD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseSingleFileDesignSystem",
    () => parseSingleFileDesignSystem,
  );
  bindRuntimeValue(
    runtime,
    "createSingleFileMigrationStore",
    () => createSingleFileMigrationStore,
  );
  bindRuntimeValue(
    runtime,
    "createSingleFileMigrationAdapter",
    () => createSingleFileMigrationAdapter,
  );
  bindRuntimeValue(
    runtime,
    "createSingleFileMigrationFiles",
    () => createSingleFileMigrationFiles,
  );
  bindRuntimeValue(
    runtime,
    "SINGLE_FILE_MIGRATION_PUBLISH_SPACING_MS",
    () => SINGLE_FILE_MIGRATION_PUBLISH_SPACING_MS,
    (value) => {
      SINGLE_FILE_MIGRATION_PUBLISH_SPACING_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifySingleFileMigrationSentinel",
    () => classifySingleFileMigrationSentinel,
  );
  bindRuntimeValue(
    runtime,
    "preflightSingleFileMigration",
    () => preflightSingleFileMigration,
  );
  bindRuntimeValue(
    runtime,
    "migrateSingleFileDesignSystem",
    () => migrateSingleFileDesignSystem,
  );
  return () => {
    OLDER_SINGLE_FILE_COPY_MESSAGE =
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      "An older copy of this design system was saved over the current one, and that older copy is what you see. Before editing, ask the agent to compare the two and keep the one you want.";
    SINGLE_FILE_MIGRATION_BACKUP_PATH =
      "project/design-system.before-files.json";
    SINGLE_FILE_REPLACEMENT_CHARACTER = String.fromCharCode(65533);
    SINGLE_FILE_SYNTHETIC_META_FIELD = "singleFile";
    SINGLE_FILE_MIGRATION_PUBLISH_SPACING_MS = 3000;
  };
}
