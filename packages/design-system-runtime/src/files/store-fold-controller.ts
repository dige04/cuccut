/** Restored application module; prepare first, initialize in original order. */
import type * as Migration from "../contracts/migration";
import type * as Model from "../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesStoreFoldController(
  runtime: RuntimeBindings & Migration.MigrationRuntime,
): () => void {
  var STORE_FOLD_DEBOUNCE_MS: number;
  var STORE_FOLD_PUBLISH_SPACING_MS: number;
  var STORE_FOLD_RETRY_DELAY_MS: number;
  var STORE_FOLD_MAX_RETRIES: number;
  function createStoreToFilesFoldController<
    Index extends object = Migration.MigrationWireIndex,
  >(options: Migration.StoreFoldOptions<Index>): Migration.StoreFoldController {
    let {
        adapter: adapter,
        files: files,
        store: store,
        timers: timers,
      } = options,
      inFlight: Promise<Migration.FoldOutcome> | undefined,
      checkOwed: boolean = false,
      lastPublishAt = -1 / 0,
      readFileText = async (input: string): Promise<string | null> => {
        try {
          return (await files.readText(input)).text;
        } catch {
          return null;
        }
      },
      readFileState = async (
        input: string,
      ): Promise<Migration.FileReadState> => {
        try {
          if (
            !(await (0, runtime.listWritableFiles)(files)).some(
              (input2): boolean => input2.path === input,
            )
          ) {
            return {
              state: "absent",
            };
          }
          return {
            state: "text",
            text: (await files.readText(input)).text,
          };
        } catch {
          return {
            state: "unreadable",
          };
        }
      };
    async function readFoldSnapshot(): Promise<
      | Migration.StoreFoldSnapshot<Index>
      | Extract<Migration.FoldOutcome, { result: "skipped" }>
    > {
      let value = await (0, runtime.readJsonFileState)(
        files,
        adapter.indexPath,
        timers,
      );
      if (value.state === "unreadable") {
        return {
          result: "skipped",
          reason: "index_unreadable",
        };
      }
      let value2 =
        value.state === "read"
          ? (0, runtime.readFileMigrationMarker)(value.value)
          : null;
      if (value.state !== "read" || value2 === null) {
        return {
          result: "skipped",
          reason: "not_on_files",
        };
      }
      if (value2.kind === "converted" && value2.marker.home === "file") {
        return {
          result: "skipped",
          reason: "no_store_home",
        };
      }
      let value3: Model.FileTextRead | null = null;
      try {
        value3 = await files.readText(runtime.MIGRATION_SENTINEL_PATH);
      } catch {
        value3 = null;
      }
      let value4 = (0, runtime.parseMigrationSentinel)(value3?.text ?? null);
      if (
        value3 === null ||
        value4 === null ||
        !(0, runtime.migrationSentinelMatchesArtifact)(
          value4,
          options.artifactId,
        )
      ) {
        return {
          result: "skipped",
          reason: "no_record",
        };
      }
      let value5 = await (0, runtime.readAllowlistedStoreDocuments)(
        store,
        adapter.allowlist,
      );
      if (!value5.has(adapter.metaPath)) {
        return {
          result: "skipped",
          reason: "store_absent",
        };
      }
      let value6 = await (0, runtime.hashStoreSnapshot)(value5, adapter),
        value7 = [...value5.values()].filter(
          (input): boolean =>
            value4.documents[input.path] !== value6.get(input.path),
        ),
        value8 = (0, runtime.readMovedToMarker)(
          value5.get(adapter.metaPath)!.data,
        ),
        value9 = Object.keys(value4.documents).filter(
          (input): boolean => !value5.has(input),
        ),
        value10 = value4.dropped ?? value4.dropping,
        value11 =
          value10?.documents !== undefined &&
          value10.stamp !== undefined &&
          value10.stamp === value8?.took
            ? new Set([
                ...(value4.dropping?.documents ?? []),
                ...(value4.dropped?.documents ?? []),
              ])
            : undefined,
        value12 =
          value8?.dropping !== undefined ||
          value8?.dropped !== undefined ||
          value4.dropping !== undefined ||
          value4.dropped !== undefined,
        value13 =
          value11 !== undefined
            ? value9.filter((input): boolean => !value11.has(input))
            : value12
              ? []
              : value9;
      return {
        index: value.value as Index,
        markerKey:
          value2.kind === "converted"
            ? runtime.CONVERTED_FROM_MARKER_KEY
            : runtime.CREATED_ON_FILES_MARKER_KEY,
        marker: value2.marker,
        indexSha: value.sha256,
        record: value4,
        recordSha: value3.sha256,
        snapshot: value5,
        digests: value6,
        changed: value7,
        removed: value13,
      };
    }
    let lastUnfoldedCount = 0;
    async function foldChangedStore(): Promise<Migration.FoldOutcome> {
      let flag: boolean = false;
      lastUnfoldedCount = 0;
      try {
        (0, runtime.validateMigrationAllowlist)(adapter);
        if (!files.canWrite) {
          return {
            result: "skipped",
            reason: "not_writer",
          };
        }
        let value = await readFoldSnapshot();
        if ("result" in value) {
          return value;
        }
        if (value.changed.length === 0 && value.removed.length === 0) {
          return {
            result: "clean",
          };
        }
        let value2 = await store.acquire(adapter.lockPath, {
          holder: options.holder,
          ttlMs: runtime.MIGRATION_LEASE_TTL_MS,
        });
        if (value2 !== "unsupported" && !value2.acquired) {
          return {
            result: "busy",
            ...(value2.expiresAt !== undefined
              ? {
                  until: value2.expiresAt,
                }
              : {}),
          };
        }
        flag = value2 !== "unsupported";
        let value3 = await readFoldSnapshot();
        if ("result" in value3) {
          return value3;
        }
        if (value3.changed.length === 0 && value3.removed.length === 0) {
          return {
            result: "clean",
          };
        }
        let entries = new Map(
            value3.changed
              .map((input): [string, Record<string, string> | undefined] => [
                input.path,
                value3.record.fields?.[input.path],
              ])
              .filter(
                (input): input is [string, Record<string, string>] =>
                  input[1] !== undefined,
              ),
          ),
          value4 = await adapter.codec.fold({
            index: value3.index,
            changed: value3.changed,
            removed: value3.removed,
            recorded: entries,
            snapshot: value3.snapshot,
            readFile: readFileText,
            readFileState: readFileState,
          }),
          value5 = (0, runtime.removeUnpublishableMigrationFiles)(
            value4.files,
            adapter.type,
          );
        (0, runtime.validateMigrationTreePaths)(
          value4.files.keys(),
          adapter.type,
        );
        let values = new Set(value4.unfolded ?? []);
        if (
          value4.files.size === 0 &&
          values.size > 0 &&
          value3.changed.every((input) => values.has(input.path)) &&
          value3.removed.every((input) => values.has(input))
        ) {
          return {
            result: "failed",
            code: "file_unreadable",
          };
        }
        let state = {
          ...value3.record,
          at: new Date(timers.now()).toISOString(),
          documents: Object.fromEntries(value3.digests),
          fields: {
            ...(value3.record.fields ?? {}),
          },
          files: {
            ...value3.record.files,
          },
        };
        for (let value11 of value3.changed) {
          state.fields[value11.path] = await (0, runtime.hashStoreFields)(
            (0, runtime.storeDocumentDigestView)(value11, adapter),
            adapter.secretFields,
          );
        }
        for (let value11 of value3.removed) {
          delete state.fields[value11];
        }
        for (let value11 of value4.unfolded ?? []) {
          let value12 = value3.record.documents[value11];
          if (value12 === undefined) {
            delete state.documents[value11];
          } else {
            state.documents[value11] = value12;
          }
          let value13 = value3.record.fields?.[value11];
          if (value13 === undefined) {
            delete state.fields[value11];
          } else {
            state.fields[value11] = value13;
          }
        }
        if ((value4.indexSources ?? []).length > 0) {
          state.indexSources = {
            ...(value3.record.indexSources ?? {}),
            ...Object.fromEntries(
              value4
                .indexSources!.filter((input) => value3.digests.has(input))
                .map((input) => [input, value3.digests.get(input)!]),
            ),
          };
        }
        let value6 = [
          ...(value4.indexSourcesGone ?? []),
          ...value3.removed,
        ].filter((input): boolean => state.indexSources?.[input] !== undefined);
        if (value6.length > 0) {
          state.indexSources = Object.fromEntries(
            Object.entries(state.indexSources!).filter(
              ([input]): boolean => !value6.includes(input),
            ),
          );
        }
        lastUnfoldedCount = (value4.unfolded ?? []).length;
        let state2: Model.FilePublishEntries = {},
          state3: Model.FilePublishEntries = {};
        for (let [value11, value12] of value4.files) {
          if (value12 === null) {
            state3[value11] = null;
            delete state.files[value11];
            continue;
          }
          state2[value11] = value12;
          let value13 = (0, runtime.normalizeFilePublishInput)(
            value11,
            value12,
          );
          if (value13 === null || typeof value13 === "string") {
            return {
              result: "failed",
              code: "invalid_content",
            };
          }
          let value14 =
            value4.sources.get(value11) ?? state.files[value11]?.from ?? [];
          state.files[value11] = {
            sha256: await (0, runtime.sha256)(
              await (0, runtime.fileContentBytes)(value13.content),
            ),
            from: value14,
            of: Object.fromEntries(
              value14
                .filter(
                  (input): boolean => state.documents[input] !== undefined,
                )
                .map((input) => [input, state.documents[input]]),
            ),
          };
        }
        let state4 = {
            ...state3,
            [runtime.MIGRATION_SENTINEL_PATH]: (0,
            runtime.serializeIndexDocument)(state),
            [adapter.indexPath]: adapter.codec.serializeIndex({
              ...value3.index,
              ...value4.index,
              [value3.markerKey]: value3.marker,
            }),
          },
          value7 = await (0, runtime.listWritableFiles)(files),
          entries2 = new Map(value7.map((input) => [input.path, input.sha256]));
        if (
          entries2.get(adapter.indexPath) !== value3.indexSha ||
          entries2.get(runtime.MIGRATION_SENTINEL_PATH) !== value3.recordSha
        ) {
          return {
            result: "failed",
            code: "conflict",
          };
        }
        let values2 = new Set(
            value7
              .filter((input): boolean => input.provisional === true)
              .map((input) => input.path),
          ),
          callback = (input: Model.FilePublishEntries) => ({
            ifMatch: Object.fromEntries(
              Object.keys(input)
                .filter((input2): boolean => !values2.has(input2))
                .map((input2) => [
                  input2,
                  input2 === adapter.indexPath
                    ? value3.indexSha
                    : input2 === runtime.MIGRATION_SENTINEL_PATH
                      ? value3.recordSha
                      : (entries2.get(input2) ?? null),
                ]),
            ),
          }),
          value8 =
            options.write ??
            ((
              input: Model.FilePublishEntries,
              options2?: Model.FilePublishPreconditions,
            ) => files.publish(input, options2)),
          value9 = files.version(),
          version = value9.version,
          value10 = (0, runtime.splitMigrationPublishBatches)({
            ...state2,
            ...state4,
          });
        for (let value11 of value10.length === 1
          ? value10
          : [...(0, runtime.splitMigrationPublishBatches)(state2), state4]) {
          lastPublishAt = timers.now();
          let value12 = await value8(value11, callback(value11));
          if (!value12.ok) {
            return {
              result: "failed",
              code: value12.code,
              ...(value12.retryAfterMs !== undefined &&
              Number.isFinite(value12.retryAfterMs) &&
              value12.retryAfterMs > 0
                ? {
                    retryAfterMs: Math.min(value12.retryAfterMs, 300000),
                  }
                : {}),
            };
          }
          version = value12.version;
        }
        if (options.onFolded !== undefined) {
          let items: Model.ChangedFileRow[] = [];
          for (let [value11, value12] of Object.entries({
            ...state2,
            ...state4,
          })) {
            items.push({
              path: value11,
              sha256:
                value12 === null
                  ? null
                  : (state.files[value11]?.sha256 ??
                    (await (0, runtime.sha256)(value12 as string))),
            });
          }
          try {
            options.onFolded({
              from: value9,
              to: {
                version: version,
              },
              changed: items,
            });
          } catch {}
        }
        return {
          result: "folded",
          documents: value3.changed.length + value3.removed.length,
          files: value4.files.size,
          ...(value5.length > 0
            ? {
                leftOut: value5,
              }
            : {}),
        };
      } catch (value) {
        let value2 = (value as { code?: unknown } | null | undefined)?.code;
        return {
          result: "failed",
          code:
            typeof value2 === "string" && /^[a-z][a-z0-9_]{0,31}$/.test(value2)
              ? value2
              : "internal",
        };
      } finally {
        if (flag) {
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
    function check(): Promise<Migration.FoldOutcome> {
      inFlight ??= foldChangedStore().then((input) => {
        inFlight = undefined;
        try {
          options.onOutcome?.(input);
        } catch {}
        return input;
      });
      return inFlight;
    }
    return {
      check: check,
      watch() {
        let value: ReturnType<Model.FilesTimers["setTimeout"]> | undefined,
          flag: boolean = false,
          index = 0,
          flag2: boolean = false,
          index2 = 0,
          callback = (input: number, options2: () => void): void => {
            if (value !== undefined) {
              timers.clearTimeout(value);
            }
            value = timers.setTimeout((): void => {
              value = undefined;
              options2();
            }, input);
          },
          callback2 = (): void => {
            if (flag) {
              return;
            }
            let value4 =
              lastPublishAt + STORE_FOLD_PUBLISH_SPACING_MS - timers.now();
            if (value4 > 0) {
              callback(value4, callback2);
              return;
            }
            checkOwed = false;
            check().then((input): void => {
              if (flag || value !== undefined) {
                return;
              }
              if (input.result === "busy") {
                let value5 =
                  input.until === undefined
                    ? NaN
                    : Date.parse(input.until) - timers.now();
                callback(
                  Number.isFinite(value5)
                    ? Math.min(
                        Math.max(value5 + 1000, STORE_FOLD_RETRY_DELAY_MS),
                        runtime.MIGRATION_LEASE_TTL_MS + 5000,
                      )
                    : STORE_FOLD_RETRY_DELAY_MS,
                  callback2,
                );
                return;
              }
              if (input.result === "failed") {
                flag2 = input.code === "conflict";
                if (index < STORE_FOLD_MAX_RETRIES) {
                  index += 1;
                  callback(
                    Math.max(
                      STORE_FOLD_RETRY_DELAY_MS,
                      input.retryAfterMs ?? 0,
                    ),
                    callback2,
                  );
                }
                return;
              }
              if (input.result === "folded") {
                index = 0;
              }
              flag2 = false;
              if (
                input.result === "folded" &&
                lastUnfoldedCount > 0 &&
                index2 < STORE_FOLD_MAX_RETRIES
              ) {
                index2 += 1;
                callback(STORE_FOLD_RETRY_DELAY_MS, callback2);
                return;
              }
              if (lastUnfoldedCount === 0) {
                index2 = 0;
              }
              if (input.result === "folded") {
                callback5();
              }
              if (checkOwed) {
                callback(STORE_FOLD_DEBOUNCE_MS, callback2);
              }
            });
          },
          callback3 = (input?: string[]): void => {
            if (flag) {
              return;
            }
            if (input !== undefined && !input.some(callback4)) {
              return;
            }
            if (input !== undefined) {
              index = 0;
            } else if (index >= STORE_FOLD_MAX_RETRIES) {
              return;
            }
            if (inFlight !== undefined) {
              checkOwed = true;
              return;
            }
            if (value === undefined) {
              callback(STORE_FOLD_DEBOUNCE_MS, callback2);
            }
          },
          items = [
            ...new Set(adapter.allowlist.map((input) => input.collection)),
          ],
          callback4 = (input: string) =>
            input !== adapter.lockPath &&
            adapter.allowlist.some((input2) =>
              input2.docId !== undefined
                ? input === input2.collection + "/" + input2.docId
                : input.startsWith(input2.collection + "/") &&
                  !input.slice(input2.collection.length + 1).includes("/"),
            ),
          value2 =
            store.watch === undefined
              ? []
              : items.map((input) => store.watch!(input, callback3)),
          value3 = files.onRemoteChange?.((): void => {
            if (flag2 && !flag && inFlight === undefined) {
              flag2 = false;
              index = 0;
              callback(STORE_FOLD_DEBOUNCE_MS, callback2);
            }
          }),
          callback5 = () =>
            (0, runtime.finishMigrationTombstone)({
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
            });
        callback5().then(callback2);
        return (): void => {
          flag = true;
          if (value !== undefined) {
            timers.clearTimeout(value);
          }
          for (let value4 of value2) {
            value4();
          }
          value3?.();
        };
      },
    };
  }
  function migrationTelemetryFailureKind(code: unknown): string {
    if (code === "rate_limited") {
      return "backpressure";
    }
    if (
      code === "conflict" ||
      code === "lease_lost" ||
      code === "store_kept_changing"
    ) {
      return "conflict";
    }
    if (code === "too_large" || code === "collection_too_large") {
      return "too_large";
    }
    if (code === "invalid_content" || code === "bad_config") {
      return "invalid_content";
    }
    if (
      code === "not_writer" ||
      code === "not_declared" ||
      code === "capability_disabled"
    ) {
      return "capability_denied";
    }
    if (code === "upstream_error") {
      return "transient";
    }
    return "internal";
  }
  function reportMigrationFailure<
    Outcome extends {
      result: string;
      code?: unknown;
    },
  >(outcome: Outcome): void {
    try {
      if (outcome.result === "aborted" || outcome.result === "failed") {
        runtime.artifactHealth.report(
          "sync",
          "failure",
          migrationTelemetryFailureKind(outcome.code),
        );
      }
    } catch {}
  }
  bindRuntimeValue(
    runtime,
    "STORE_FOLD_DEBOUNCE_MS",
    () => STORE_FOLD_DEBOUNCE_MS,
    (value) => {
      STORE_FOLD_DEBOUNCE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORE_FOLD_PUBLISH_SPACING_MS",
    () => STORE_FOLD_PUBLISH_SPACING_MS,
    (value) => {
      STORE_FOLD_PUBLISH_SPACING_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORE_FOLD_RETRY_DELAY_MS",
    () => STORE_FOLD_RETRY_DELAY_MS,
    (value) => {
      STORE_FOLD_RETRY_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORE_FOLD_MAX_RETRIES",
    () => STORE_FOLD_MAX_RETRIES,
    (value) => {
      STORE_FOLD_MAX_RETRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createStoreToFilesFoldController",
    () => createStoreToFilesFoldController,
  );
  bindRuntimeValue(
    runtime,
    "migrationTelemetryFailureKind",
    () => migrationTelemetryFailureKind,
  );
  bindRuntimeValue(
    runtime,
    "reportMigrationFailure",
    () => reportMigrationFailure,
  );
  return () => {
    STORE_FOLD_DEBOUNCE_MS = 1000;
    STORE_FOLD_PUBLISH_SPACING_MS = 1e4;
    STORE_FOLD_RETRY_DELAY_MS = 5000;
    STORE_FOLD_MAX_RETRIES = 5;
  };
}
