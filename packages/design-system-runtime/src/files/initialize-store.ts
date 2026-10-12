import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesInitializeStore(
  runtime: RuntimeBindings,
): () => void {
  var ARTIFACT_REOPENED_STORAGE_KEY: string;
  async function initializeEmptyFilesStore(
    options: Boot.InitializeStoreOptions,
  ): Promise<Boot.InitializeStoreResult> {
    try {
      if (!options.files.canWrite) {
        return {
          result: "skipped",
          reason: "not_writer",
        };
      }
      let value = await (0, runtime.readJsonFileState)(
        options.files,
        options.indexPath,
        options.timers,
      );
      if (value.state === "unreadable") {
        return {
          result: "skipped",
          reason: "index_unreadable",
        };
      }
      if (
        value.state === "read" &&
        (0, runtime.readFileMigrationMarker)(value.value) !== null
      ) {
        return {
          result: "skipped",
          reason: "already_files",
        };
      }
      let callback = async (): Promise<
          Extract<Boot.InitializeStoreResult, { result: "skipped" }> | undefined
        > => {
          let value6 =
            options.otherHome === undefined
              ? "absent"
              : await options.otherHome();
          if (value6 === "content") {
            return {
              result: "skipped",
              reason: "store_has_content",
            };
          } else {
            if (value6 === "unreadable") {
              return {
                result: "skipped",
                reason: "index_unreadable",
              };
            } else {
              return undefined;
            }
          }
        },
        value2 = await callback();
      if (value2 !== undefined) {
        return value2;
      }
      if (!(await options.storeUntouched())) {
        return {
          result: "skipped",
          reason: "store_has_content",
        };
      }
      let state = {
          ...options.emptyIndex(),
          [runtime.CREATED_ON_FILES_MARKER_KEY]: (0,
          runtime.createdOnFilesMarker)({
            at: options.at,
          }),
        },
        state2 = {
          [options.indexPath]: options.serializeIndex(state),
        };
      if (options.mark !== undefined) {
        let state3 = {
          v: 1,
          type: options.mark.type,
          at: options.at,
          ...(options.mark.artifactId !== undefined
            ? {
                artifact: options.mark.artifactId,
              }
            : {}),
          documents: {
            [options.mark.metaPath]: await (0, runtime.hashStoreDocument)({}),
          },
          fields: {
            [options.mark.metaPath]: await (0, runtime.hashStoreFields)({}),
          },
          files: {},
        };
        state2[runtime.MIGRATION_SENTINEL_PATH] = (0,
        runtime.serializeIndexDocument)(state3);
      }
      let value3 = await (0, runtime.readJsonFileState)(
        options.files,
        options.indexPath,
        options.timers,
      );
      if (value3.state === "unreadable") {
        return {
          result: "skipped",
          reason: "index_unreadable",
        };
      }
      if (
        value3.state === "read" &&
        (0, runtime.readFileMigrationMarker)(value3.value) !== null
      ) {
        return {
          result: "skipped",
          reason: "already_files",
        };
      }
      if (
        value3.state === "read" &&
        options.rootHoldsContent?.(value3.value) === true
      ) {
        return {
          result: "skipped",
          reason: "store_has_content",
        };
      }
      let value4 = await callback();
      if (value4 !== undefined) {
        return value4;
      }
      let value5 = await options.files.publish(state2, {
        ifMatch: Object.fromEntries(
          Object.keys(state2).map((input) => [
            input,
            input === options.indexPath && value3.state === "read"
              ? value3.sha256
              : null,
          ]),
        ),
      });
      if (!value5.ok) {
        return {
          result: "failed",
          code: value5.code,
        };
      }
      if (options.mark !== undefined) {
        let { store: mark, metaPath: mark2 } = options.mark,
          state3 = {
            [runtime.MOVED_TO_MARKER_KEY]: (0, runtime.movedToMarker)({
              path: options.indexPath,
              ver: value5.version,
              at: options.at,
            }),
          };
        if (
          !(await mark.update(mark2, state3).then(
            (): boolean => true,
            (): boolean => false,
          )) &&
          mark.set !== undefined
        ) {
          if (
            !(await mark.get(mark2).then(
              (input): boolean => input !== null,
              (): boolean => true,
            ))
          ) {
            await mark.set(mark2, state3).catch((): void => {
              return;
            });
          }
        }
      }
      return {
        result: "created",
        version: value5.version,
      };
    } catch {
      return {
        result: "failed",
        code: "upstream_error",
      };
    }
  }
  function announceAndWaitToReopen(
    options: Boot.AnnounceReopenOptions,
  ): Promise<void> {
    let timers = options.timers,
      leadMs = options.leadMs ?? 2500,
      maxTypingHoldMs = leadMs + (options.maxHoldMs ?? 15000),
      startedAt = timers.now();
    try {
      options.say(options.message);
    } catch {}
    let isTyping = (): boolean | undefined => {
        try {
          return options.isTyping?.() === true;
        } catch {
          return false;
        }
      },
      hasUnsentEdits = (): boolean | undefined => {
        try {
          return options.hasUnsentEdits?.() === true;
        } catch {
          return false;
        }
      };
    return new Promise((input): void => {
      let callback = (): void => {
          if (options.note !== undefined) {
            try {
              options.note.store?.setItem(
                "appifact-reopened",
                JSON.stringify({
                  why: options.note.why,
                  at: timers.now(),
                  ...(options.note.focus !== undefined
                    ? {
                        focus: options.note.focus,
                      }
                    : {}),
                }),
              );
            } catch {}
          }
          try {
            options.reopen();
          } finally {
            input();
          }
        },
        callback2 = (): void => {
          let value = timers.now() - startedAt;
          if (
            value >= leadMs &&
            !hasUnsentEdits() &&
            (!isTyping() || value >= maxTypingHoldMs)
          ) {
            callback();
            return;
          }
          timers.setTimeout(
            callback2,
            value < leadMs ? Math.min(leadMs - value, 250) : 250,
          );
        };
      callback2();
    });
  }
  function consumeReopenMessage(
    storage:
      | Pick<globalThis.Storage, "getItem" | "removeItem">
      | null
      | undefined,
    now: number,
  ): Boot.ReopenNote | undefined {
    let raw: string | null = null;
    try {
      raw = storage?.getItem("appifact-reopened") ?? null;
    } catch {
      return;
    }
    if (raw === null) {
      return;
    }
    try {
      storage?.removeItem("appifact-reopened");
    } catch {}
    try {
      let value = JSON.parse(raw) as {
        why?: unknown;
        at?: unknown;
        focus?: unknown;
      } | null;
      if (
        value === null ||
        typeof value.why !== "string" ||
        typeof value.at !== "number" ||
        now - value.at > 60000 ||
        now < value.at - 1000
      ) {
        return;
      }
      return {
        why: value.why,
        at: value.at,
        ...(typeof value.focus === "string"
          ? {
              focus: value.focus,
            }
          : {}),
      };
    } catch {
      return;
    }
  }
  function announceReopenedArtifact(
    options: Boot.AnnounceReopenedOptions,
  ): boolean {
    let note = consumeReopenMessage(options.store, options.now);
    if (note === undefined) {
      return false;
    }
    try {
      options.focus(note.focus);
    } catch {}
    try {
      options.say(options.message(note));
    } catch {}
    return true;
  }
  bindRuntimeValue(
    runtime,
    "initializeEmptyFilesStore",
    () => initializeEmptyFilesStore,
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_REOPENED_STORAGE_KEY",
    () => ARTIFACT_REOPENED_STORAGE_KEY,
    (value) => {
      ARTIFACT_REOPENED_STORAGE_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "announceAndWaitToReopen",
    () => announceAndWaitToReopen,
  );
  bindRuntimeValue(runtime, "consumeReopenMessage", () => consumeReopenMessage);
  bindRuntimeValue(
    runtime,
    "announceReopenedArtifact",
    () => announceReopenedArtifact,
  );
  return () => {
    ARTIFACT_REOPENED_STORAGE_KEY = "appifact-reopened";
  };
}
