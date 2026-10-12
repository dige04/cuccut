/** Restored application module; prepare first, initialize in original order. */
import type * as Migration from "../contracts/migration";
import type * as Model from "../contracts";
import type * as Files from "../contracts/files-core";
import type * as Storage from "../contracts/model-storage";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesMigrationEngine(
  runtime: RuntimeBindings & Migration.MigrationRuntime,
): () => void {
  var isPublishableFilePath: (path: string) => boolean;
  var MIGRATION_LEASE_TTL_MS: number;
  var MIGRATION_LEASE_RENEWAL_MS: number;
  var MIGRATION_BATCH_MAX_FILES: number;
  var MIGRATION_BATCH_MAX_BYTES: number;
  var MIGRATION_PUBLISH_SPACING_MS: number;
  var MIGRATION_MAX_STORE_RECHECKS: number;
  var MIGRATION_RETRY_INITIAL_MS: number;
  var MIGRATION_RETRY_MAX_MS: number;
  var MIGRATION_PUBLISH_RETRY_WINDOW_MS: number;
  var MIGRATION_UPSTREAM_RETRY_WINDOW_MS: number;
  var LEGACY_DATABASE_LIST_LIMIT: number;
  var MIGRATION_SENTINEL_PATH: string;
  var MigrationConfigError: new (message: string) => Error;
  var PUBLIC_STORE_READ_LEVELS: string[];
  var storePathParts: (path: string) => string[];
  var storePathHasPrefix: (parts: string[], prefix: string[]) => boolean;
  var allowlistedStorePath: (
    entry: Model.FilesMigrationAllowlistEntry,
  ) => string;
  var MIGRATION_INTERNAL_META_FIELDS: string[];
  var MigrationLimitError: new (code: string) => Error & { code: string };
  var storeDocumentDigestView: (
    document: Model.FilesMigrationStoreDocument,
    adapter?: Pick<Migration.MigrationAdapter, "digestView">,
  ) => Record<string, unknown>;
  var migrationErrorCode: (error: unknown) => string;
  function storeReadAccessLevel(path: string, rules: Migration.DatabaseRule[]) {
    let parts = storePathParts(path);
    if (parts[0] === "data" && parts[1] === "users") {
      return "private";
    }
    let level = "view",
      longestMatch = -1;
    for (let value of rules) {
      let value2 = storePathParts(value.path);
      if (value2[value2.length - 1] === "{self}") {
        if (
          storePathHasPrefix(parts, value2.slice(0, -1)) &&
          parts.length >= value2.length
        ) {
          return "private";
        }
        continue;
      }
      if (
        !storePathHasPrefix(parts, value2) ||
        value.read === undefined ||
        value2.length < longestMatch
      ) {
        continue;
      }
      level = value.read;
      longestMatch = value2.length;
    }
    if (PUBLIC_STORE_READ_LEVELS.includes(level)) {
      return level;
    } else {
      return "private";
    }
  }
  function validateMigrationAllowlist(
    adapter: Pick<Migration.MigrationAdapter<object>, "allowlist" | "dbRules">,
  ): void {
    for (let value of adapter.allowlist) {
      let value2 = allowlistedStorePath(value);
      if (
        [
          ...value.collection.split("/"),
          ...(value.docId === undefined ? [] : [value.docId]),
        ].some(
          (input) =>
            !/^[A-Za-z0-9_.~:@+-]+$/.test(input) ||
            input === "." ||
            input === "..",
        )
      ) {
        throw new MigrationConfigError(
          "not a store path: " + JSON.stringify(value2),
        );
      }
      let value3 = storePathParts(value2),
        items = [storeReadAccessLevel(value2, adapter.dbRules)];
      for (let value5 of adapter.dbRules) {
        let value6 = storePathParts(value5.path);
        if (
          value6.length > value3.length &&
          storePathHasPrefix(value6, value3)
        ) {
          items.push(
            value6[value6.length - 1] === "{self}"
              ? "private"
              : storeReadAccessLevel(value5.path, adapter.dbRules),
          );
        }
      }
      let value4 = items.find((input): boolean => input !== "view");
      if (value4 !== undefined) {
        throw new MigrationConfigError(
          "store kind " +
            JSON.stringify(value2) +
            " is readable only at " +
            value4 +
            ": it must not be in the allowlist",
        );
      }
    }
  }
  async function hashStoreDocument(
    document2: Record<string, unknown>,
    secretFields: string[] = [],
  ): Promise<string> {
    let filtered: Record<string, unknown> = {};
    for (let [value, value2] of Object.entries(document2)) {
      if (
        !MIGRATION_INTERNAL_META_FIELDS.includes(value) &&
        !secretFields.includes(value)
      ) {
        filtered[value] = value2;
      }
    }
    return (0, runtime.sha256)((0, runtime.serializeIndexDocument)(filtered));
  }
  async function readAllowlistedStoreDocuments(
    store: Model.FilesMigrationStore,
    allowlist: Model.FilesMigrationAllowlistEntry[],
  ): Promise<Migration.StoreSnapshot> {
    let documents: Migration.StoreSnapshot = new Map();
    for (let value of allowlist) {
      if (value.docId !== undefined) {
        let value3 = await store.get(allowlistedStorePath(value));
        if (value3 !== null && value3.path === allowlistedStorePath(value)) {
          documents.set(value3.path, value3);
        }
        continue;
      }
      let value2 = await store.list(value.collection);
      if (value2.length >= LEGACY_DATABASE_LIST_LIMIT) {
        throw new MigrationLimitError("collection_too_large");
      }
      for (let value3 of value2) {
        if (
          value3.path.startsWith(value.collection + "/") &&
          !value3.path.slice(value.collection.length + 1).includes("/")
        ) {
          documents.set(value3.path, value3);
        }
      }
    }
    return documents;
  }
  function hashCanonicalIndex(value: unknown) {
    return (0, runtime.sha256)(
      (0, runtime.serializeIndexDocument)(value === undefined ? null : value),
    );
  }
  async function hashStoreFields(
    document2: Record<string, unknown>,
    secretFields: string[] = [],
  ): Promise<Record<string, string>> {
    let fields: Record<string, string> = {};
    for (let [value, value2] of Object.entries(document2)) {
      if (
        !MIGRATION_INTERNAL_META_FIELDS.includes(value) &&
        !secretFields.includes(value)
      ) {
        fields[value] = await hashCanonicalIndex(value2);
      }
    }
    return fields;
  }
  async function hashStoreSnapshot(
    snapshot: Migration.StoreSnapshot,
    adapter: Pick<
      Migration.MigrationAdapter<object>,
      "secretFields" | "digestView"
    > = {},
  ): Promise<Map<string, string>> {
    let digests = new Map<string, string>();
    for (let [value, value2] of snapshot) {
      digests.set(
        value,
        await hashStoreDocument(
          storeDocumentDigestView(value2, adapter),
          adapter.secretFields,
        ),
      );
    }
    return digests;
  }
  function parseMigrationSentinel(text: string | null) {
    if (text === null) {
      return null;
    }
    try {
      let value: unknown = JSON.parse(text),
        callback = (input: unknown): input is Record<string, unknown> =>
          typeof input === "object" && input !== null && !Array.isArray(input);
      if (
        value !== null &&
        ((value as { v?: unknown }).v === 1 ||
          (value as { v?: unknown }).v === 2) &&
        callback((value as { documents?: unknown }).documents) &&
        callback((value as { files?: unknown }).files)
      ) {
        return value as Model.FilesMigrationSentinel;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function migrationSentinelMatchesArtifact(
    sentinel: Model.FilesMigrationSentinel,
    artifactId?: string,
  ) {
    return (
      sentinel.artifact === undefined ||
      artifactId === undefined ||
      sentinel.artifact === artifactId
    );
  }
  function splitMigrationPublishBatches(entries: Model.FilePublishEntries) {
    let batches: Model.FilePublishEntries[] = [],
      batch: Model.FilePublishEntries = {},
      count = 0,
      bytes = 0;
    for (let [value, value2] of Object.entries(entries)) {
      let value3 = (0, runtime.filePublishEncodedBytes)(value2);
      if (
        count > 0 &&
        (count + 1 > MIGRATION_BATCH_MAX_FILES ||
          bytes + value3 > MIGRATION_BATCH_MAX_BYTES)
      ) {
        batches.push(batch);
        batch = {};
        count = 0;
        bytes = 0;
      }
      batch[value] = value2;
      count += 1;
      bytes += value3;
    }
    if (count > 0) {
      batches.push(batch);
    }
    return batches;
  }
  function createMigrationPublisher(
    files: Migration.MigrationFilesPort,
    timers: Model.FilesTimers,
    stillOwnsLease: () => boolean | Promise<boolean> = (): boolean => true,
  ) {
    let lastAttemptAt = -1 / 0,
      calls = 0,
      wait = (input: number) =>
        new Promise<void>((input2) => void timers.setTimeout(input2, input));
    return {
      calls: () => calls,
      async publish(
        input: Model.FilePublishEntries,
        options?: Model.FilePublishPreconditions,
      ): Promise<Model.FilePublishResult> {
        let value = timers.now(),
          value2: number = MIGRATION_RETRY_INITIAL_MS,
          value3: Model.FilePublishFailure | undefined;
        for (;;) {
          let value4: number =
            MIGRATION_PUBLISH_SPACING_MS - (timers.now() - lastAttemptAt);
          if (value4 > 0) {
            await wait(value4);
          }
          if (!(await stillOwnsLease())) {
            return (
              value3 ?? {
                ok: false,
                code: "conflict",
              }
            );
          }
          lastAttemptAt = timers.now();
          calls += 1;
          let value5: Model.FilePublishResult;
          try {
            value5 = await files.publish(input, options);
          } catch {
            value5 = {
              ok: false,
              code: "upstream_error",
            };
          }
          if (value5.ok) {
            return value5;
          }
          value3 = value5;
          if (
            !(
              value5.code === "rate_limited" ||
              value5.code === "conflict" ||
              value5.code === "upstream_error"
            )
          ) {
            return value5;
          }
          if (
            timers.now() - value >=
            (value5.code === "upstream_error"
              ? MIGRATION_UPSTREAM_RETRY_WINDOW_MS
              : MIGRATION_PUBLISH_RETRY_WINDOW_MS)
          ) {
            await stillOwnsLease();
            return value5;
          }
          let value6 =
            value5.code === "rate_limited" &&
            value5.retryAfterMs !== undefined &&
            Number.isFinite(value5.retryAfterMs) &&
            value5.retryAfterMs >= 0
              ? value5.retryAfterMs
              : undefined;
          await wait(
            Math.min(value6 ?? value2, MIGRATION_PUBLISH_RETRY_WINDOW_MS),
          );
          value2 = Math.min(MIGRATION_RETRY_MAX_MS, value2 * 2);
        }
      },
    };
  }
  function migrationVersionSize(
    listing: Pick<Model.FileListingRow, "path" | "size">[],
    tree: Pick<Migration.MigrationTree<object>, "files">,
    indexPath: string,
    indexContent: Model.FilePublishInput,
  ) {
    let treePaths = new Set([
        ...tree.files.keys(),
        MIGRATION_SENTINEL_PATH,
        indexPath,
      ]),
      bytes = (0, runtime.filePublishRawBytes)(indexContent);
    for (let value of listing) {
      if (!treePaths.has(value.path) && Number.isFinite(value.size)) {
        bytes += value.size;
      }
    }
    let oversized: string[] = [];
    for (let [value, value2] of tree.files) {
      if (
        ((bytes += (0, runtime.filePublishRawBytes)(value2)),
        (0, runtime.filePublishEncodedBytes)(value2) >
          runtime.MAX_FILE_PUBLISH_ENCODED_BYTES)
      ) {
        oversized.push(value);
      }
    }
    bytes += 2048 * (tree.files.size + 1);
    return {
      files: new Set([...listing.map((input) => input.path), ...treePaths])
        .size,
      bytes: bytes,
      oversized: oversized,
    };
  }
  function validateMigrationTreePaths(
    paths: Iterable<string>,
    type: Files.FileArtifactType,
  ): void {
    for (let value of paths) {
      if (
        (0, runtime.canonicalFilePathWithinPrefix)(
          runtime.PROJECT_FILE_PREFIX,
          value,
        ) !== value
      ) {
        throw new MigrationConfigError(
          "not canonical: " + JSON.stringify(value),
        );
      }
      if ((0, runtime.isPrivateProjectFile)(type, value)) {
        throw new MigrationConfigError(
          "the page's own file in a codec's tree: " + JSON.stringify(value),
        );
      }
    }
  }
  async function hashMigrationFileInput(
    path: string,
    input: Model.FilePublishInput,
  ): Promise<string> {
    let normalized = (0, runtime.normalizeFilePublishInput)(path, input);
    if (normalized === null || typeof normalized === "string") {
      throw new MigrationConfigError(
        typeof normalized === "string" ? normalized : path + ": no content",
      );
    }
    return (0, runtime.sha256)(
      await (0, runtime.fileContentBytes)(normalized.content),
    );
  }
  async function finishMigrationTombstone(
    options: Pick<
      Migration.MigrationOptions<object>,
      "files" | "store" | "timers" | "artifactId"
    > & { indexPath: string; metaPath: string },
  ): Promise<boolean | undefined> {
    try {
      if (!options.files.canWrite) {
        return false;
      }
      let value = await (0, runtime.readJsonFileState)(
          options.files,
          options.indexPath,
          options.timers,
        ),
        value2 =
          value.state === "read"
            ? (0, runtime.readFileMigrationMarker)(value.value)
            : null;
      if (value2 === null) {
        return false;
      }
      let value3: Model.FilesMigrationSentinel | null = null;
      try {
        value3 = parseMigrationSentinel(
          (await options.files.readText(MIGRATION_SENTINEL_PATH)).text,
        );
      } catch {
        value3 = null;
      }
      if (
        value3 === null ||
        value3.documents[options.metaPath] === undefined ||
        !migrationSentinelMatchesArtifact(value3, options.artifactId)
      ) {
        return false;
      }
      let value4 = await options.store.get(options.metaPath);
      if (
        value4 === null ||
        (0, runtime.readMovedToMarker)(value4.data) !== null
      ) {
        return false;
      }
      let state = {
        ...(value3.dropping !== undefined
          ? {
              dropping: value3.dropping.at,
            }
          : {}),
        ...(value3.dropped !== undefined
          ? {
              dropped: value3.dropped.at,
            }
          : {}),
      };
      await options.store.update(options.metaPath, {
        [runtime.MOVED_TO_MARKER_KEY]: {
          ...(0, runtime.movedToMarker)({
            path: options.indexPath,
            ver: options.files.version().version,
            at: value2.marker.at,
          }),
          ...state,
        },
        [runtime.CONVERTING_MARKER_KEY]: null,
      });
      return true;
    } catch {
      return false;
    }
  }
  async function migrateStoreToFiles<Index extends object = Model.FilesIndex>(
    options: Migration.MigrationOptions<Index>,
  ): Promise<Migration.MigrationOutcome> {
    let {
        adapter: adapter,
        files: files,
        store: store,
        timers: timers,
      } = options,
      startedAt = timers.now(),
      stage = "preflight",
      setStage = (input: string): void => {
        stage = input;
        try {
          options.onStage?.(input);
        } catch {}
      },
      aborted = (input: string): Migration.MigrationOutcome => ({
        result: "aborted",
        stage: stage,
        code: input,
        ms: timers.now() - startedAt,
      }),
      renewalTimer: ReturnType<Model.FilesTimers["setTimeout"]> | undefined,
      leaseLost: boolean = false,
      acquiredLease: boolean = false,
      supportsLease: boolean = true,
      fenceWritten: boolean = false,
      lastLeaseRefreshAt = timers.now(),
      finishing: boolean = false,
      isoNow = () => new Date(timers.now()).toISOString(),
      leaseExpired = (): boolean =>
        timers.now() - lastLeaseRefreshAt >=
        (supportsLease
          ? MIGRATION_LEASE_TTL_MS
          : runtime.MIGRATION_LOCK_TTL_MS),
      checkLeaseExpired = (): boolean => {
        if (leaseExpired()) {
          leaseLost = true;
        }
        return leaseLost;
      },
      checkMigrationOwnership = async (): Promise<string | null> => {
        if (checkLeaseExpired()) {
          return "lease_lost";
        }
        let value = await store.get(adapter.metaPath);
        if (
          value !== null &&
          (0, runtime.readMovedToMarker)(value.data) !== null
        ) {
          return "already_moved";
        }
        let value2 =
          value === null
            ? null
            : (0, runtime.activeConvertingMarker)(value.data, timers.now());
        if (value2 !== null && value2.holder !== options.holder) {
          return "lease_lost";
        }
        let value3 = await (0, runtime.readJsonFileState)(
          files,
          adapter.indexPath,
          timers,
        );
        if (checkLeaseExpired()) {
          return "lease_lost";
        }
        if (value3.state === "unreadable") {
          return "index_unreadable";
        }
        let value4 =
          value3.state === "read"
            ? (0, runtime.readFileMigrationMarker)(value3.value)
            : null;
        remoteConversionMarker =
          value4?.kind === "converted" ? value4.marker : undefined;
        if (value4 !== null) {
          return "already_files";
        } else {
          return null;
        }
      },
      remoteConversionMarker: Storage.DatabaseRecord | undefined,
      renewalInFlight: Promise<void> | undefined,
      versionCaps = options.versionCaps ?? runtime.DEFAULT_FILE_VERSION_CAPS,
      exceedsVersionCaps = (
        input: Model.FileListing,
        options2: Migration.MigrationTree<Index>,
      ) => {
        let value = migrationVersionSize(
          input,
          options2,
          adapter.indexPath,
          adapter.codec.serializeIndex(options2.index),
        );
        return (
          value.files > versionCaps.files ||
          value.bytes > versionCaps.bytes ||
          value.oversized.length > 0
        );
      };
    try {
      validateMigrationAllowlist(adapter);
      if (!files.canWrite) {
        return {
          result: "skipped",
          reason: files.narrowed === true ? "narrowed_listing" : "not_writer",
        };
      }
      let value = await (0, runtime.readJsonFileState)(
        files,
        adapter.indexPath,
        timers,
      );
      if (
        files.narrowed === true ||
        (value.state === "unreadable" && value.narrowed === true)
      ) {
        return {
          result: "skipped",
          reason: "narrowed_listing",
        };
      }
      if (value.state === "unreadable") {
        return aborted("index_unreadable");
      }
      if (
        value.state === "read" &&
        (0, runtime.readFileMigrationMarker)(value.value) !== null
      ) {
        return {
          result: "skipped",
          reason: "already_files",
          ...((await finishMigrationTombstone({
            indexPath: adapter.indexPath,
            metaPath: adapter.metaPath,
            files: files,
            store: store,
            timers: timers,
            ...(options.artifactId !== undefined
              ? {
                  artifactId: options.artifactId,
                }
              : {}),
          }))
            ? {
                tombstoned: true,
              }
            : {}),
        };
      }
      let value2 = await store.get(adapter.metaPath);
      if (value2 === null) {
        return {
          result: "skipped",
          reason: "empty_store",
        };
      }
      if ((0, runtime.readMovedToMarker)(value2.data) !== null) {
        return {
          result: "skipped",
          reason: "already_moved",
        };
      }
      let value3 = (0, runtime.activeConvertingMarker)(
        value2.data,
        timers.now(),
      );
      if (value3 !== null && value3.holder !== options.holder) {
        return {
          result: "busy",
        };
      }
      if (options.force !== true) {
        if ((await options.sharedExternally?.()) === true) {
          return {
            result: "skipped",
            reason: "shared_externally",
          };
        }
        if ((await options.embedsArtifacts?.()) === true) {
          return {
            result: "skipped",
            reason: "embeds_artifacts",
          };
        }
      }
      let value4 = await adapter.codec.toTree(
          await readAllowlistedStoreDocuments(store, adapter.allowlist),
          {
            preflight: true,
          },
        ),
        value5 = (0, runtime.damagedTextFiles)(value4);
      if (value5.length > 0) {
        return {
          result: "skipped",
          reason: "unsendable_content",
          leftOut: value5,
        };
      }
      let value6 = await (0, runtime.listWritableFiles)(files).catch(
        (): void => {
          return;
        },
      );
      (0, runtime.removeUnpublishableMigrationFiles)(
        value4.files,
        adapter.type,
      );
      if (value6 !== undefined && exceedsVersionCaps(value6, value4)) {
        return {
          result: "skipped",
          reason: "too_large",
        };
      }
      setStage("lease");
      let value7 = timers.now(),
        value8 = await store.acquire(adapter.lockPath, {
          holder: options.holder,
          ttlMs: MIGRATION_LEASE_TTL_MS,
        });
      lastLeaseRefreshAt = value7;
      if (value8 === "unsupported") {
        supportsLease = false;
      } else {
        if (!value8.acquired) {
          return {
            result: "busy",
            ...(value8.expiresAt !== undefined
              ? {
                  until: value8.expiresAt,
                }
              : {}),
          };
        }
        acquiredLease = true;
      }
      let value9 = await checkMigrationOwnership();
      if (value9 === "already_files" || value9 === "already_moved") {
        return {
          result: "skipped",
          reason: value9,
        };
      }
      if (value9 === "index_unreadable") {
        return aborted(value9);
      }
      if (value9 !== null) {
        return {
          result: "busy",
        };
      }
      let callback = () =>
          store.update(adapter.metaPath, {
            [runtime.CONVERTING_MARKER_KEY]: {
              by: options.by,
              at: isoNow(),
              holder: options.holder,
            },
          }),
        callback2 = (): void => {
          renewalTimer = timers.setTimeout((): void => {
            renewalInFlight = (async (): Promise<void> => {
              if (finishing) {
                return;
              }
              let value21 = await checkMigrationOwnership();
              if (value21 !== null && value21 !== "index_unreadable") {
                leaseLost = true;
                return;
              }
              let value22 = timers.now(),
                value23 = supportsLease
                  ? await store.acquire(adapter.lockPath, {
                      holder: options.holder,
                      ttlMs: MIGRATION_LEASE_TTL_MS,
                    })
                  : "unsupported";
              if (value23 !== "unsupported" && !value23.acquired) {
                leaseLost = true;
                return;
              }
              if (checkLeaseExpired()) {
                return;
              }
              if (fenceWritten && !finishing) {
                await callback();
              }
              lastLeaseRefreshAt = value22;
            })()
              .catch((): void => {
                return;
              })
              .then((): void => {
                renewalInFlight = undefined;
                if (renewalTimer !== undefined && !leaseLost && !finishing) {
                  callback2();
                }
              });
          }, MIGRATION_LEASE_RENEWAL_MS);
        };
      callback2();
      setStage("fence");
      await callback();
      fenceWritten = true;
      if (!supportsLease) {
        let value21 = await store.get(adapter.metaPath);
        if (
          value21 !== null &&
          (0, runtime.readConvertingMarker)(value21.data)?.holder !==
            options.holder
        ) {
          fenceWritten = false;
          return {
            result: "busy",
          };
        }
      }
      setStage("snapshot");
      let value10 = await (0, runtime.listWritableFiles)(files),
        entries = new Map(value10.map((input) => [input.path, input.sha256])),
        values = new Set(
          value10
            .filter((input): boolean => input.provisional === true)
            .map((input) => input.path),
        ),
        value11 = await readAllowlistedStoreDocuments(store, adapter.allowlist),
        value12 = await hashStoreSnapshot(value11, adapter),
        value13 = await adapter.codec.toTree(value11);
      if ((0, runtime.damagedTextFiles)(value13).length > 0) {
        return {
          result: "skipped",
          reason: "unsendable_content",
          leftOut: (0, runtime.damagedTextFiles)(value13),
        };
      }
      let value14 = (0, runtime.removeUnpublishableMigrationFiles)(
        value13.files,
        adapter.type,
      );
      validateMigrationTreePaths(value13.files.keys(), adapter.type);
      if (exceedsVersionCaps(value10, value13)) {
        return {
          result: "skipped",
          reason: "too_large",
        };
      }
      setStage("publish");
      let value15: string | null = null,
        value16 = createMigrationPublisher(
          files,
          timers,
          async (): Promise<boolean> => {
            value15 = await checkMigrationOwnership();
            return value15 === null;
          },
        ),
        entries2 = new Map<string, string>(),
        flag: boolean = true,
        callback3 = (
          input: Model.FilePublishFailure,
        ): Migration.MigrationOutcome => {
          if (value15 === "already_files" || value15 === "already_moved") {
            return {
              result: "skipped",
              reason: value15,
            };
          }
          if (value15 === "index_unreadable") {
            return aborted(value15);
          }
          if (value15 === "lease_lost" || leaseLost) {
            return aborted("lease_lost");
          }
          if (
            flag &&
            (input.code === "capability_disabled" ||
              input.code === "not_declared")
          ) {
            return {
              result: "skipped",
              reason: "files_unavailable",
            };
          } else {
            return aborted(input.code);
          }
        },
        callback4 = (input: string[]) => ({
          ifMatch: Object.fromEntries(
            input
              .filter((input2): boolean => !values.has(input2))
              .map((input2) => [
                input2,
                entries2.get(input2) ?? entries.get(input2) ?? null,
              ]),
          ),
        }),
        callback5 = async (): Promise<Model.FilePublishFailure | undefined> => {
          let state4: Model.FilePublishEntries = {},
            entries3 = new Map();
          for (let [value21, value22] of value13.files) {
            let value23 = await hashMigrationFileInput(value21, value22);
            entries3.set(value21, value23);
            if ((entries2.get(value21) ?? entries.get(value21)) !== value23) {
              state4[value21] = value22;
            }
          }
          for (let value21 of entries2.keys()) {
            if (!value13.files.has(value21)) {
              state4[value21] = null;
            }
          }
          for (let value21 of splitMigrationPublishBatches(state4)) {
            let value22 = await value16.publish(
              value21,
              callback4(Object.keys(value21)),
            );
            if (!value22.ok) {
              return value22;
            }
            flag = false;
            for (let [value23, value24] of Object.entries(value21)) {
              if (value24 === null) {
                entries2.delete(value23);
                values.delete(value23);
                continue;
              }
              let value25 =
                value22.shas?.[value23] !== undefined &&
                value22.computed?.includes(value23) !== true;
              entries2.set(
                value23,
                value25 ? value22.shas![value23] : entries3.get(value23)!,
              );
              if (
                !value25 &&
                (0, runtime.fileContentContainsRuntimeMarkers)(value24)
              ) {
                values.add(value23);
              } else {
                values.delete(value23);
              }
            }
          }
          return;
        },
        value17 = await callback5();
      if (value17 !== undefined) {
        return callback3(value17);
      }
      setStage("recheck");
      let index = 0;
      for (;;) {
        let value21 = await readAllowlistedStoreDocuments(
            store,
            adapter.allowlist,
          ),
          value22 = await hashStoreSnapshot(value21, adapter);
        if (
          value22.size === value12.size &&
          [...value22].every(
            ([input, input2]): boolean => value12.get(input) === input2,
          )
        ) {
          break;
        }
        index += 1;
        if (index > MIGRATION_MAX_STORE_RECHECKS) {
          return aborted("store_kept_changing");
        }
        value11 = value21;
        value12 = value22;
        value13 = await adapter.codec.toTree(value11);
        if ((0, runtime.damagedTextFiles)(value13).length > 0) {
          return aborted("unsendable_content");
        }
        value14 = (0, runtime.removeUnpublishableMigrationFiles)(
          value13.files,
          adapter.type,
        );
        validateMigrationTreePaths(value13.files.keys(), adapter.type);
        if (exceedsVersionCaps(value10, value13)) {
          return aborted("too_large");
        }
        let value23 = await callback5();
        if (value23 !== undefined) {
          return callback3(value23);
        }
      }
      setStage("sentinel");
      let value18 = isoNow(),
        state: Model.FilesMigrationSentinel & {
          fields: Record<string, Record<string, string>>;
        } = {
          v: 1,
          vouching: 1,
          type: adapter.type,
          at: value18,
          ...(options.artifactId !== undefined
            ? {
                artifact: options.artifactId,
              }
            : {}),
          documents: Object.fromEntries(value12),
          fields: {},
          files: {},
        };
      for (let [value21, value22] of value11) {
        state.fields[value21] = await hashStoreFields(
          storeDocumentDigestView(value22, adapter),
          adapter.secretFields,
        );
      }
      for (let value21 of value13.files.keys()) {
        let value22 = value13.sources.get(value21) ?? [];
        state.files[value21] = {
          sha256: entries2.get(value21) ?? entries.get(value21) ?? "",
          from: value22,
          of: Object.fromEntries(
            value22
              .filter((input) => value12.has(input))
              .map((input) => [input, value12.get(input)!]),
          ),
        };
      }
      if ((value13.indexSources ?? []).length > 0) {
        state.indexSources = Object.fromEntries(
          value13
            .indexSources!.filter((input) => value12.has(input))
            .map((input) => [input, value12.get(input)!]),
        );
      }
      let value19 = (await adapter.kept?.()) ?? {};
      if (Object.keys(value19).length > 0) {
        state.kept = value19;
      }
      let state2 = {
          ...value13.index,
          [runtime.CONVERTED_FROM_MARKER_KEY]: (0, runtime.convertedFromMarker)(
            {
              at: value18,
              by: options.by,
              ...(adapter.home !== undefined
                ? {
                    home: adapter.home,
                  }
                : {}),
            },
          ),
        },
        value20 = await value16.publish(
          {
            [MIGRATION_SENTINEL_PATH]: (0, runtime.serializeIndexDocument)(
              state,
            ),
            [adapter.indexPath]: adapter.codec.serializeIndex(state2),
          },
          callback4([MIGRATION_SENTINEL_PATH, adapter.indexPath]),
        ),
        callback6 = (input: Storage.DatabaseRecord | undefined) =>
          input !== undefined &&
          input.at === value18 &&
          input.by === options.by;
      if (
        !value20.ok &&
        value15 === "already_files" &&
        callback6(remoteConversionMarker)
      ) {
        value20 = {
          ok: true,
          version: files.version().version,
        };
      }
      if (!value20.ok) {
        let value21 = await (0, runtime.readJsonFileState)(
            files,
            adapter.indexPath,
            timers,
          ),
          value22 =
            value21.state === "read"
              ? (0, runtime.readFileMigrationMarker)(value21.value)
              : null;
        if (value22?.kind === "converted" && callback6(value22.marker)) {
          value20 = {
            ok: true,
            version: files.version().version,
          };
        }
      }
      if (!value20.ok) {
        return callback3(value20);
      }
      setStage("tombstone");
      finishing = true;
      await renewalInFlight;
      let state3 = {
          [runtime.MOVED_TO_MARKER_KEY]: (0, runtime.movedToMarker)({
            path: adapter.indexPath,
            ver: value20.version,
            at: value18,
          }),
          [runtime.CONVERTING_MARKER_KEY]: null,
        },
        flag2 = false;
      for (let index2: number = 0; index2 < 3 && !flag2; index2++) {
        if (index2 > 0) {
          await new Promise<void>(
            (input) => void timers.setTimeout(input, 500 * index2),
          );
        }
        flag2 = await store.update(adapter.metaPath, state3).then(
          (): boolean => true,
          (): boolean => false,
        );
      }
      fenceWritten = false;
      return {
        result: "converted",
        version: value20.version,
        files: value13.files.size,
        calls: value16.calls(),
        rechecks: index,
        ms: timers.now() - startedAt,
        ...(flag2
          ? {}
          : {
              tombstoned: false,
            }),
        ...(value14.length > 0
          ? {
              leftOut: value14,
            }
          : {}),
      };
    } catch (value) {
      return aborted(
        value instanceof MigrationConfigError
          ? "bad_config"
          : value instanceof MigrationLimitError
            ? value.code
            : migrationErrorCode(value),
      );
    } finally {
      finishing = true;
      if (renewalTimer !== undefined) {
        timers.clearTimeout(renewalTimer);
        renewalTimer = undefined;
      }
      await renewalInFlight;
      if (fenceWritten) {
        let value = await store.get(adapter.metaPath).catch((): null => null);
        if (
          value !== null &&
          (0, runtime.readConvertingMarker)(value.data)?.holder ===
            options.holder
        ) {
          await store
            .update(adapter.metaPath, {
              [runtime.CONVERTING_MARKER_KEY]: null,
            })
            .catch((): void => {
              return;
            });
        }
      }
      if (acquiredLease && !checkLeaseExpired()) {
        await store
          .acquire(adapter.lockPath, {
            holder: options.holder,
            ttlMs: 1000,
          })
          .catch((): void => {
            return;
          });
      }
    }
  }
  bindRuntimeValue(
    runtime,
    "isPublishableFilePath",
    () => isPublishableFilePath,
    (value) => {
      isPublishableFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_LEASE_TTL_MS",
    () => MIGRATION_LEASE_TTL_MS,
    (value) => {
      MIGRATION_LEASE_TTL_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_LEASE_RENEWAL_MS",
    () => MIGRATION_LEASE_RENEWAL_MS,
    (value) => {
      MIGRATION_LEASE_RENEWAL_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_BATCH_MAX_FILES",
    () => MIGRATION_BATCH_MAX_FILES,
    (value) => {
      MIGRATION_BATCH_MAX_FILES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_BATCH_MAX_BYTES",
    () => MIGRATION_BATCH_MAX_BYTES,
    (value) => {
      MIGRATION_BATCH_MAX_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_PUBLISH_SPACING_MS",
    () => MIGRATION_PUBLISH_SPACING_MS,
    (value) => {
      MIGRATION_PUBLISH_SPACING_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_MAX_STORE_RECHECKS",
    () => MIGRATION_MAX_STORE_RECHECKS,
    (value) => {
      MIGRATION_MAX_STORE_RECHECKS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_RETRY_INITIAL_MS",
    () => MIGRATION_RETRY_INITIAL_MS,
    (value) => {
      MIGRATION_RETRY_INITIAL_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_RETRY_MAX_MS",
    () => MIGRATION_RETRY_MAX_MS,
    (value) => {
      MIGRATION_RETRY_MAX_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_PUBLISH_RETRY_WINDOW_MS",
    () => MIGRATION_PUBLISH_RETRY_WINDOW_MS,
    (value) => {
      MIGRATION_PUBLISH_RETRY_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_UPSTREAM_RETRY_WINDOW_MS",
    () => MIGRATION_UPSTREAM_RETRY_WINDOW_MS,
    (value) => {
      MIGRATION_UPSTREAM_RETRY_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_DATABASE_LIST_LIMIT",
    () => LEGACY_DATABASE_LIST_LIMIT,
    (value) => {
      LEGACY_DATABASE_LIST_LIMIT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_SENTINEL_PATH",
    () => MIGRATION_SENTINEL_PATH,
    (value) => {
      MIGRATION_SENTINEL_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MigrationConfigError",
    () => MigrationConfigError,
    (value) => {
      MigrationConfigError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PUBLIC_STORE_READ_LEVELS",
    () => PUBLIC_STORE_READ_LEVELS,
    (value) => {
      PUBLIC_STORE_READ_LEVELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "storePathParts",
    () => storePathParts,
    (value) => {
      storePathParts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "storePathHasPrefix",
    () => storePathHasPrefix,
    (value) => {
      storePathHasPrefix = value;
    },
  );
  bindRuntimeValue(runtime, "storeReadAccessLevel", () => storeReadAccessLevel);
  bindRuntimeValue(
    runtime,
    "allowlistedStorePath",
    () => allowlistedStorePath,
    (value) => {
      allowlistedStorePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateMigrationAllowlist",
    () => validateMigrationAllowlist,
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_INTERNAL_META_FIELDS",
    () => MIGRATION_INTERNAL_META_FIELDS,
    (value) => {
      MIGRATION_INTERNAL_META_FIELDS = value;
    },
  );
  bindRuntimeValue(runtime, "hashStoreDocument", () => hashStoreDocument);
  bindRuntimeValue(
    runtime,
    "MigrationLimitError",
    () => MigrationLimitError,
    (value) => {
      MigrationLimitError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readAllowlistedStoreDocuments",
    () => readAllowlistedStoreDocuments,
  );
  bindRuntimeValue(runtime, "hashCanonicalIndex", () => hashCanonicalIndex);
  bindRuntimeValue(runtime, "hashStoreFields", () => hashStoreFields);
  bindRuntimeValue(
    runtime,
    "storeDocumentDigestView",
    () => storeDocumentDigestView,
    (value) => {
      storeDocumentDigestView = value;
    },
  );
  bindRuntimeValue(runtime, "hashStoreSnapshot", () => hashStoreSnapshot);
  bindRuntimeValue(
    runtime,
    "parseMigrationSentinel",
    () => parseMigrationSentinel,
  );
  bindRuntimeValue(
    runtime,
    "migrationSentinelMatchesArtifact",
    () => migrationSentinelMatchesArtifact,
  );
  bindRuntimeValue(
    runtime,
    "migrationErrorCode",
    () => migrationErrorCode,
    (value) => {
      migrationErrorCode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "splitMigrationPublishBatches",
    () => splitMigrationPublishBatches,
  );
  bindRuntimeValue(
    runtime,
    "createMigrationPublisher",
    () => createMigrationPublisher,
  );
  bindRuntimeValue(runtime, "migrationVersionSize", () => migrationVersionSize);
  bindRuntimeValue(
    runtime,
    "validateMigrationTreePaths",
    () => validateMigrationTreePaths,
  );
  bindRuntimeValue(
    runtime,
    "hashMigrationFileInput",
    () => hashMigrationFileInput,
  );
  bindRuntimeValue(
    runtime,
    "finishMigrationTombstone",
    () => finishMigrationTombstone,
  );
  bindRuntimeValue(runtime, "migrateStoreToFiles", () => migrateStoreToFiles);
  return () => {
    isPublishableFilePath = (input): boolean =>
      (0, runtime.validateFilePath)(input) === undefined;
    MIGRATION_LEASE_TTL_MS = 120000;
    MIGRATION_LEASE_RENEWAL_MS = 45000;
    MIGRATION_BATCH_MAX_FILES = 200;
    MIGRATION_BATCH_MAX_BYTES = 15728640;
    MIGRATION_PUBLISH_SPACING_MS = 3000;
    MIGRATION_MAX_STORE_RECHECKS = 3;
    MIGRATION_RETRY_INITIAL_MS = 2000;
    MIGRATION_RETRY_MAX_MS = 30000;
    MIGRATION_PUBLISH_RETRY_WINDOW_MS = 300000;
    MIGRATION_UPSTREAM_RETRY_WINDOW_MS = 30000;
    LEGACY_DATABASE_LIST_LIMIT = 1000;
    MIGRATION_SENTINEL_PATH = runtime.MIGRATION_MANIFEST_PATH;
    MigrationConfigError = class MigrationConfigError extends Error {};
    PUBLIC_STORE_READ_LEVELS = ["view", "interact", "admin", "owner"];
    storePathParts = (input) =>
      input.split("/").filter((input2): boolean => input2 !== "");
    storePathHasPrefix = (items, items2) =>
      items2.length <= items.length &&
      items2.every((input, options): boolean => input === items[options]);
    allowlistedStorePath = (input) =>
      input.docId === undefined
        ? input.collection
        : input.collection + "/" + input.docId;
    MIGRATION_INTERNAL_META_FIELDS = [
      runtime.CONVERTING_MARKER_KEY,
      runtime.MOVED_TO_MARKER_KEY,
    ];
    MigrationLimitError = class MigrationLimitError extends Error {
      code: string;
      constructor(input: string) {
        super(input);
        this.code = input;
      }
    };
    storeDocumentDigestView = (input, options = {}) =>
      options.digestView !== undefined ? options.digestView(input) : input.data;
    migrationErrorCode = (input) => {
      let value = (input as { code?: unknown } | null | undefined)?.code;
      if (typeof value === "string" && /^[a-z][a-z0-9_]{0,31}$/.test(value)) {
        return value;
      } else {
        return "internal";
      }
    };
  };
}
