/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformLiveDocument(
  runtime: RuntimeBindings,
): () => void {
  var liveDocumentFlushers: Dynamic;
  var LIVE_WRITE_DEBOUNCE_MS: Dynamic;
  var LIVE_WRITE_MAX_WAIT_MS: Dynamic;
  var LIVE_INITIAL_LOAD_TIMEOUT_MS: Dynamic;
  var LIVE_RECONNECT_BACKOFF_MS: Dynamic;
  var LIVE_RECENT_RECONNECT_DELAY_MS: Dynamic;
  var LIVE_RECENT_RECONNECT_WINDOW_MS: Dynamic;
  var LIVE_MAX_RECOVERY_RETRIES: Dynamic;
  var LIVE_WRITE_ACK_TIMEOUT_MS: Dynamic;
  var LIVE_STUCK_WRITE_TIMEOUT_MS: Dynamic;
  var LIVE_MAX_PATCH_PROPERTY_COUNT: Dynamic;
  var LIVE_CONFLICT_RETRY_MS: Dynamic;
  var LIVE_WRITE_RETRY_INITIAL_BACKOFF_MS: Dynamic;
  var LIVE_MAX_WRITE_RETRY_BACKOFF_MS: Dynamic;
  var LIVE_RETRY_INITIAL_BACKOFF_MS: Dynamic;
  var LIVE_RETRY_MAX_BACKOFF_MS: Dynamic;
  var LIVE_ERROR_SURFACE_DELAY_MS: Dynamic;
  var LIVE_FRAME_FALLBACK_DELAY_MS: Dynamic;
  var LIVE_MAX_ACKNOWLEDGED_WRITES: Dynamic;
  var LIVE_EXTENDED_LOAD_TIMEOUT_MS: Dynamic;
  var LIVE_MAX_INFLIGHT_WRITES: Dynamic;
  var LIVE_SYNC_EXPLANATION: Dynamic;
  function registerLiveDocumentFlusher(flush?: Dynamic): Dynamic {
    liveDocumentFlushers.add(flush);
    return (): Dynamic => {
      liveDocumentFlushers.delete(flush);
    };
  }
  function createLiveDocumentTimers(): Dynamic {
    return {
      setTimeout: (input?: Dynamic, options?: Dynamic): Dynamic =>
        setTimeout(input, options),
      clearTimeout: (input?: Dynamic): Dynamic => clearTimeout(input),
      now: (): Dynamic => Date.now(),
      random: (): Dynamic => Math.random(),
      frame:
        typeof requestAnimationFrame == "function"
          ? (input?: Dynamic): Dynamic =>
              requestAnimationFrame((): Dynamic => input())
          : undefined,
    };
  }
  function formatSyncTime(timestamp?: Dynamic): Dynamic {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return new Date(timestamp).toISOString().slice(11, 16);
    }
  }
  function pluralizeSyncCount(count?: Dynamic, noun?: Dynamic): Dynamic {
    return count + " " + noun + (count === 1 ? "" : "s");
  }
  function createLiveDocument(options?: Dynamic): Dynamic {
    let { codec: codec, db: database }: Dynamic = options,
      timers: Dynamic = options.timers ?? createLiveDocumentTimers(),
      collections: Dynamic = codec.collections,
      metaPath: Dynamic = codec.metaPath,
      canWrite: Dynamic = options.canWrite;
    function parseContentOrFallback(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      try {
        return options.parseContent(input);
      } catch {
        return options2;
      }
    }
    function normalizeTitle(input?: Dynamic, options2?: Dynamic): Dynamic {
      return (
        (0, runtime.normalizeDocumentTitle)(
          typeof input == "string" ? input.trim() : input,
        ) ?? options2
      );
    }
    let state: Dynamic = {
        title: normalizeTitle(options.defaultTitle, "Appifact"),
        content: options.initialContent,
        comments: [],
      },
      pathStates: Dynamic = new Map(),
      effectiveDocuments: Dynamic = new Map(),
      documentSizes: Dynamic = new Map(),
      decomposedDocuments: Dynamic = new Map(),
      value: Dynamic,
      loadState: Dynamic = "loading",
      loadedCollections: Dynamic = new Set(),
      collectionSubscriptions: Dynamic = [],
      subscriptionGeneration: Dynamic = 0,
      value2: Dynamic,
      flag: Dynamic = false,
      flag2: Dynamic = false,
      index: Dynamic = 0,
      value3: Dynamic,
      loadedMetadataCollections: Dynamic = new Set(),
      flag3: Dynamic = false,
      flag4: Dynamic = false,
      value4: Dynamic,
      value5: Dynamic,
      index2: Dynamic = 0,
      flag5: Dynamic = false,
      flag6: Dynamic = false,
      flag7: Dynamic = false,
      index3: Dynamic = 0,
      value6: Dynamic,
      callback: Dynamic = (): Dynamic =>
        (!flag3 || flag6) && (!flag7 || index3 < LIVE_MAX_RECOVERY_RETRIES),
      value7: Dynamic,
      inFlightWrites: Dynamic = new Map(),
      parkedWrites: Dynamic = new Map(),
      index4: Dynamic = 0,
      value8: Dynamic,
      flag8: Dynamic = false,
      index5: Dynamic = 0,
      index6: Dynamic = 0,
      value9: Dynamic,
      flag9: Dynamic = false,
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(),
      values3: Dynamic = new Set(),
      flag10: Dynamic = false,
      flag11: Dynamic = false,
      flag12: Dynamic = false,
      value10: Dynamic,
      flag13: Dynamic = false,
      value11: Dynamic,
      value12: Dynamic,
      value13: Dynamic,
      value14: Dynamic,
      value15: Dynamic,
      flag14: Dynamic = false,
      flag15: Dynamic = false,
      contentListeners: Dynamic = new Set(),
      saveListeners: Dynamic = new Set(),
      stuckListeners: Dynamic = new Set(),
      loadListeners: Dynamic = new Set();
    function ensurePathState(input?: Dynamic): Dynamic {
      let entry: Dynamic = pathStates.get(input);
      entry === undefined &&
        ((entry = {
          exists: false,
          removedSeen: false,
          acked: [],
          firstAt: 0,
          lastAt: 0,
          due: false,
          notBefore: 0,
          failures: 0,
          seq: 0,
          held: false,
        }),
        pathStates.set(input, entry));
      return entry;
    }
    function applyPendingPatch(
      input?: Dynamic,
      options2?: Dynamic,
      context: Dynamic = false,
    ): Dynamic {
      if (options2 === undefined) return input;
      if (
        options2.patch !== runtime.DELETE_DOCUMENT &&
        !(input === undefined && !options2.replace && context)
      )
        return options2.replace || input === undefined
          ? options2.patch
          : (0, runtime.deepMerge)(input, options2.patch);
    }
    function effectivePathValue(input?: Dynamic): Dynamic {
      let entry: Dynamic = pathStates.get(input);
      if (entry === undefined) return;
      let value23: Dynamic =
          entry.held && entry.heldBase !== undefined
            ? (entry.heldBase ?? undefined)
            : entry.server,
        value24: Dynamic = entry.removedSeen && entry.server === undefined;
      for (let value25 of entry.acked as Dynamic)
        value23 = value25.del
          ? undefined
          : applyPendingPatch(value23, value25, value24);
      entry.inflightEchoed !== true &&
        (value23 = applyPendingPatch(value23, entry.inflight, value24));
      value23 = applyPendingPatch(value23, entry.pending, value24);
      return value23;
    }
    function updateEffectiveDocument(input?: Dynamic): Dynamic {
      let value23: Dynamic = effectivePathValue(input),
        value24: Dynamic =
          value23 === undefined
            ? undefined
            : (0, runtime.removeNullValues)(value23),
        entry: Dynamic = effectiveDocuments.get(input);
      return value24 === undefined
        ? entry === undefined
          ? false
          : (effectiveDocuments.delete(input),
            documentSizes.delete(input),
            true)
        : entry !== undefined && (0, runtime.structurallyEqual)(entry, value24)
          ? false
          : (effectiveDocuments.set(input, value24),
            documentSizes.set(
              input,
              (0, runtime.serializedDocumentBytes)(value24),
            ),
            true);
    }
    function collectionContentSize(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      let index9: Dynamic = 0;
      for (let [value23, value24] of documentSizes as Dynamic) {
        if (value23 === options2 || (0, runtime.dirname)(value23) !== input)
          continue;
        let entry: Dynamic = pathStates.get(value23);
        index9 +=
          entry?.parked !== undefined
            ? entry.server !== undefined
              ? (0, runtime.serializedDocumentBytes)(entry.server)
              : 0
            : value24;
      }
      return index9;
    }
    function isLoaded(): Dynamic {
      return loadState === "live" || loadState === "cached";
    }
    function pendingWriteCount(): Dynamic {
      let index9: Dynamic = 0;
      for (let value23 of pathStates.values() as Dynamic)
        value23.pending !== undefined && (index9 += 1);
      for (let value23 of inFlightWrites.keys() as Dynamic)
        pathStates.get(value23)?.pending === undefined && (index9 += 1);
      return index9 + (flag8 ? 1 : 0);
    }
    function getSaveState(): Dynamic {
      if (value7 !== undefined)
        return {
          status: "readonly",
          message: "Live sync ended for this view. Reload to continue.",
        };
      if (loadState === "loading")
        return {
          status: "loading",
          message: "Loading the latest content\u2026",
        };
      if (loadState === "failed")
        return {
          status: "error",
          message: "The latest content failed to load. Click to retry.",
        };
      if (loadState === "cached") {
        if (!canWrite)
          return {
            status: "readonly",
            message: "Showing a saved copy. Reconnecting\u2026",
          };
        if (
          pendingWriteCount() === 0 &&
          inFlightWrites.size === 0 &&
          parkedWrites.size === 0
        )
          return values.size > 0
            ? {
                status: "cached",
                message:
                  "Showing your saved copy. Your changes will sync when you\u2019re back online.",
              }
            : {
                status: "cached",
                message: "Showing your saved copy. Reconnecting\u2026",
              };
      }
      if (flag)
        return canWrite
          ? {
              status: "error",
              message:
                "Live updates stopped. Reconnecting; click to retry now. Your edits are kept on this screen.",
            }
          : {
              status: "readonly",
              message: "Live updates stopped. Reconnecting\u2026",
            };
      if (!canWrite)
        return {
          status: "readonly",
          message:
            options.readOnlyReason ??
            "Read-only. You\u2019re seeing live changes.",
        };
      let value23: Dynamic = pendingWriteCount();
      if (parkedWrites.size > 0) {
        let [value24]: Dynamic = parkedWrites.values(),
          value25: Dynamic = value15?.code === "refused";
        return {
          status: "error",
          message:
            (value24 ?? "A change could not be stored.") +
            (value23 > parkedWrites.size
              ? " Other changes keep syncing."
              : "") +
            (value25
              ? " Shorten it to resume syncing this item."
              : " Click to retry."),
        };
      }
      return flag9 ||
        (value9 !== undefined &&
          timers.now() - value9 > LIVE_ERROR_SURFACE_DELAY_MS)
        ? {
            status: "error",
            message:
              (inFlightWrites.size > 0
                ? "The store is unreachable. Retrying now."
                : "The store is unreachable. Retrying shortly; click to retry now.") +
              " Your edits are kept on this screen.",
          }
        : inFlightWrites.size > 0
          ? {
              status: "saving",
              message: "Syncing\u2026",
            }
          : value23 > 0
            ? {
                status: "dirty",
                message:
                  pluralizeSyncCount(value23, "change") + " waiting to sync.",
              }
            : values.size > 0
              ? value11 !== undefined &&
                timers.now() - value11 < LIVE_WRITE_ACK_TIMEOUT_MS
                ? ((value12 ??= timers.setTimeout(
                    (): Dynamic => {
                      value12 = undefined;
                      notifySaveState();
                    },
                    value11 + LIVE_WRITE_ACK_TIMEOUT_MS - timers.now(),
                  )),
                  {
                    status: "saving",
                    message: "Syncing\u2026",
                  })
                : {
                    status: "dirty",
                    message: "Changes saved on this device, not yet synced.",
                  }
              : {
                  status: "ready",
                  message:
                    (value14 !== undefined
                      ? "All changes synced \xB7 " + formatSyncTime(value14)
                      : flag14
                        ? "All changes synced"
                        : "Synced") +
                    ". " +
                    LIVE_SYNC_EXPLANATION,
                };
    }
    let text: Dynamic = "";
    function notifySaveState(): Dynamic {
      let value23: Dynamic = getSaveState(),
        value24: Dynamic = value23.status + "|" + (value23.message ?? "");
      if (value24 !== text) {
        text = value24;
        for (let value25 of [...saveListeners] as Dynamic) value25(value23);
      }
    }
    function notifyContent(input?: Dynamic): Dynamic {
      for (let value23 of [...contentListeners] as Dynamic)
        value23(
          input
            ? {
                remote: true,
              }
            : undefined,
        );
      notifySaveState();
    }
    function setLoadState(input?: Dynamic): Dynamic {
      if (loadState !== input) {
        loadState = input;
        for (let value23 of [...loadListeners] as Dynamic) value23();
        notifySaveState();
      }
    }
    function composeDocument(input?: Dynamic): Dynamic {
      flag8 && decomposeChanges();
      let value23: Dynamic;
      try {
        value23 = codec.compose(effectiveDocuments, value);
      } catch (value24: Dynamic) {
        console.error(
          "appifact sync: compose failed; keeping the current content",
          value24,
        );
        return;
      }
      value = value23.carry;
      flag6 = value23.dangling.some(
        (input2?: Dynamic): Dynamic =>
          pathStates.get(input2)?.removedSeen !== true,
      );
      loadState === "live" &&
        (flag6 && value5 === undefined && value4 === undefined
          ? value19()
          : !flag6 && flag3 && !flag4 && (clearReconnectTimer(), (index2 = 0)));
      state = {
        title: normalizeTitle(value23.title, state.title),
        content: parseContentOrFallback(value23.content, state.content),
        comments: (0, runtime.parseDocumentComments)(value23.comments),
      };
      decomposedDocuments = new Map(
        codec.decompose(state, decomposedDocuments, value),
      );
      notifyContent(input);
    }
    function changeDocument(input?: Dynamic): Dynamic {
      state = input;
      if (!flag8) {
        flag8 = true;
        let value23: Dynamic =
          typeof document !== "undefined" &&
          (document as Dynamic).visibilityState === "hidden";
        timers.frame !== undefined && !value23
          ? timers.frame(decomposeChanges)
          : timers.setTimeout(decomposeChanges, LIVE_FRAME_FALLBACK_DELAY_MS);
      }
      notifyContent(false);
    }
    function decomposeChanges(): Dynamic {
      if (!flag8 || flag15) return;
      flag8 = false;
      let entries3: Dynamic = new Map(
          codec.decompose(state, decomposedDocuments, value),
        ),
        value23: Dynamic = decomposedDocuments;
      decomposedDocuments = entries3;
      if (value7 !== undefined || !canWrite || !isLoaded()) {
        notifySaveState();
        return;
      }
      let value24: Dynamic = timers.now(),
        flag19: Dynamic = false;
      for (let [value25, value26] of entries3 as Dynamic) {
        let entry: Dynamic = value23.get(value25);
        if (entry === value26) continue;
        let value27: Dynamic = (0, runtime.diffRecord)(entry, value26);
        if (value27 === null) continue;
        let entry2: Dynamic = pathStates.get(value25),
          value28: Dynamic =
            entry2 === undefined ||
            (entry2.server === undefined &&
              !entry2.exists &&
              !entry2.removedSeen &&
              entry2.inflight === undefined &&
              entry2.pending === undefined),
          value29: Dynamic =
            value25 === metaPath &&
            entry2 !== undefined &&
            entry2.removedSeen &&
            entry2.server === undefined &&
            !entry2.exists;
        entry !== undefined && (value28 || value29)
          ? queueReplacement(
              value25,
              value26,
              value24,
              value28 ? entry : undefined,
            )
          : entry !== undefined && codec.replaceOnly?.(value25) === true
            ? queueReplacement(value25, value26, value24)
            : queuePatch(value25, value27, entry === undefined, value24);
        flag19 = true;
      }
      for (let value25 of value23.keys() as Dynamic)
        entries3.has(value25) ||
          (queueDeletion(value25, value24), (flag19 = true));
      flag19 ? scheduleWriteFlush() : notifySaveState();
    }
    function queuePatch(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value23?: Dynamic,
    ): Dynamic {
      let value24: Dynamic = ensurePathState(input),
        pending: Dynamic = value24.pending;
      touchPendingState(value24, value23, pending === undefined);
      pending === undefined || pending.patch === runtime.DELETE_DOCUMENT
        ? ((value24.pending = {
            patch: options2,
            replace: pending !== undefined || context,
          }),
          value24.pending.replace && (value24.reAdd = !value24.exists))
        : pending.replace
          ? (value24.pending = {
              patch: (0, runtime.removeNullValues)(
                (0, runtime.deepMerge)(pending.patch, options2),
              ),
              replace: true,
            })
          : ((value24.pending = undefined),
            (value24.pending = combinePendingPatches(
              pending.patch,
              options2,
              effectivePathValue(input),
            )),
            value24.pending === undefined &&
              withdrawPendingWrite(input, value24));
      value24.pending !== undefined && validatePendingWrite(input, value24);
      updateEffectiveDocument(input);
    }
    function queueReplacement(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value23?: Dynamic,
    ): Dynamic {
      let value24: Dynamic = ensurePathState(input);
      touchPendingState(value24, context, value24.pending === undefined);
      value24.pending = {
        patch: (0, runtime.removeNullValues)(options2),
        replace: true,
      };
      value24.reAdd = !value24.exists;
      value23 !== undefined && (value24.createBase ??= value23);
      validatePendingWrite(input, value24);
      updateEffectiveDocument(input);
    }
    function rebaseReplacementPatch(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      let value23: Dynamic = (0, runtime.diffRecord)(input, options2);
      if (value23 === null) return null;
      let state2: Dynamic = {
        ...value23,
      };
      for (let value24 of Object.keys(state2) as Dynamic) {
        let value25: Dynamic = input[value24],
          value26: Dynamic = options2[value24],
          value27: Dynamic = context[value24],
          callback5: Dynamic = (input2?: Dynamic): Dynamic =>
            Array.isArray(input2) &&
            input2.every(
              (input3?: Dynamic): Dynamic => typeof input3 == "string",
            );
        if (!callback5(value25) || !callback5(value26) || !callback5(value27))
          continue;
        let items2: Dynamic = [
          ...value27,
          ...value26.filter(
            (input2?: Dynamic): Dynamic =>
              !value25.includes(input2) && !value27.includes(input2),
          ),
        ];
        (0, runtime.structurallyEqual)(items2, value27)
          ? delete state2[value24]
          : (state2[value24] = items2);
      }
      return Object.keys(state2).length === 0 ? null : state2;
    }
    function combinePendingPatches(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      let value23: Dynamic = (0, runtime.mergeCompatibleRecords)(
        input,
        options2,
      );
      if (value23 !== null)
        return {
          patch: value23,
          replace: false,
        };
      if (context === undefined)
        return {
          patch: (0, runtime.deepMerge)(input, options2),
          replace: false,
        };
      let value24: Dynamic = (0, runtime.diffRecord)(
        context,
        (0, runtime.deepMerge)(
          (0, runtime.deepMerge)(context, input),
          options2,
        ),
      );
      return value24 === null
        ? undefined
        : {
            patch: value24,
            replace: false,
          };
    }
    function queueDeletion(input?: Dynamic, options2?: Dynamic): Dynamic {
      let value23: Dynamic = ensurePathState(input);
      touchPendingState(value23, options2, value23.pending === undefined);
      value23.pending = {
        patch: runtime.DELETE_DOCUMENT,
        replace: false,
      };
      value23.parked = undefined;
      parkedWrites.delete(input);
      updateEffectiveDocument(input);
    }
    function touchPendingState(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      context &&
        ((input.firstAt = options2),
        (input.seq = ++index4),
        (input.notBefore = 0));
      input.lastAt = options2;
      input.due = false;
    }
    function validatePendingWrite(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      if (
        codec.refuse === undefined ||
        options2.pending === undefined ||
        options2.pending.patch === runtime.DELETE_DOCUMENT
      )
        return;
      let value23: Dynamic = effectivePathValue(input);
      if (value23 === undefined) return;
      let value24: Dynamic =
          collectionContentSize((0, runtime.dirname)(input), input) +
          (0, runtime.serializedDocumentBytes)(value23),
        value25: Dynamic = codec.refuse(input, value23, value24);
      if (value25 === undefined) {
        options2.parked !== undefined &&
          ((options2.parked = undefined), parkedWrites.delete(input));
        return;
      }
      options2.parked = value25;
      parkedWrites.set(input, value25);
      value15 = {
        code: "refused",
        message: value25,
        path: input,
      };
    }
    function scheduleWriteFlush(): Dynamic {
      if (flag15 || value7 !== undefined) return;
      value8 !== undefined &&
        (timers.clearTimeout(value8), (value8 = undefined));
      let value23: Dynamic = timers.now(),
        value24: Dynamic = 1 / 0;
      for (let value25 of pathStates.values() as Dynamic)
        if (!(value25.pending === undefined || value25.parked !== undefined)) {
          if (!value25.due) {
            let value26: Dynamic = Math.min(
              value25.lastAt + LIVE_WRITE_DEBOUNCE_MS,
              value25.firstAt + LIVE_WRITE_MAX_WAIT_MS,
            );
            value26 <= value23
              ? (value25.due = true)
              : (value24 = Math.min(value24, value26));
          }
          value25.due &&
            value25.notBefore > value23 &&
            (value24 = Math.min(value24, value25.notBefore));
        }
      index5 > value23 && (value24 = Math.min(value24, index5));
      flushDueWrites();
      value24 !== 1 / 0 &&
        value8 === undefined &&
        (value8 = timers.setTimeout(
          (): Dynamic => {
            value8 = undefined;
            scheduleWriteFlush();
          },
          Math.max(0, value24 - timers.now()),
        ));
      notifySaveState();
    }
    function collectionWriteOrder(input?: Dynamic): Dynamic {
      let value23: Dynamic = collections.indexOf((0, runtime.dirname)(input));
      return value23 < 0 ? collections.length : value23;
    }
    function selectNextWrite(): Dynamic {
      let value23: Dynamic = timers.now(),
        value24: Dynamic,
        index9: Dynamic = 0,
        index10: Dynamic = 0,
        index11: Dynamic = 0;
      for (let [value25, value26] of pathStates as Dynamic) {
        if (
          value26.pending === undefined ||
          !value26.due ||
          value26.notBefore > value23 ||
          value26.parked !== undefined ||
          inFlightWrites.has(value25)
        )
          continue;
        let value27: Dynamic =
            value26.pending.patch === runtime.DELETE_DOCUMENT ? 1 : 0,
          value28: Dynamic = collectionWriteOrder(value25),
          value29: Dynamic = value27
            ? -value28
            : value28 + (value25 === metaPath ? 0.5 : 0);
        (value24 === undefined ||
          value27 < index9 ||
          (value27 === index9 &&
            (value29 < index10 ||
              (value29 === index10 && value26.seq < index11)))) &&
          ((value24 = value25),
          (index9 = value27),
          (index10 = value29),
          (index11 = value26.seq));
      }
      return value24;
    }
    function shouldPauseWrites(): Dynamic {
      return (
        flag15 ||
        value7 !== undefined ||
        !canWrite ||
        !isLoaded() ||
        flag ||
        inFlightWrites.size >= (flag13 ? 1 : LIVE_MAX_INFLIGHT_WRITES)
      );
    }
    function flushDueWrites(): Dynamic {
      let flag19: Dynamic = false;
      for (; !shouldPauseWrites() && index5 <= timers.now(); ) {
        let value23: Dynamic = selectNextWrite();
        if (value23 === undefined) break;
        sendWrite(value23) && (flag19 = true);
      }
      flag19 && notifySaveState();
    }
    function sendWrite(input?: Dynamic): Dynamic {
      let entry: Dynamic = pathStates.get(input),
        pending: Dynamic = entry.pending;
      entry.pending = undefined;
      let value23: Dynamic;
      if (pending.patch === runtime.DELETE_DOCUMENT)
        value23 = {
          path: input,
          verb: "delete",
          op: pending,
          sent: timers.now(),
        };
      else {
        if (
          !pending.replace &&
          entry.removedSeen &&
          !entry.exists &&
          entry.server === undefined
        ) {
          withdrawPendingWrite(input, entry);
          updateEffectiveDocument(input);
          composeDocument(true);
          entry.goneNoticed !== true &&
            options.onNotice?.(
              "An item you were editing was deleted by someone else.",
            );
          entry.goneNoticed = true;
          return false;
        }
        let value24: Dynamic = previewInflightValue(input, entry, pending);
        if (value24 === undefined) return false;
        let state2: Dynamic = {
          patch: pending.patch,
          replace: pending.replace,
        };
        if (
          pending.replace &&
          entry.exists &&
          entry.server === undefined &&
          entry.removedSeen
        ) {
          let value27: Dynamic = effectivePathValue(input),
            value28: Dynamic =
              value27 === undefined
                ? undefined
                : (0, runtime.diffRecord)(
                    value27,
                    (0, runtime.removeNullValues)(value24),
                  );
          if (value28 === null) return false;
          value28 !== undefined &&
            (state2 = {
              patch: value28,
              replace: false,
            });
        }
        let value25: Dynamic =
            !state2.replace &&
            loadState === "live" &&
            !flag &&
            !entry.held &&
            entry.acked.length === 0 &&
            entry.server !== undefined &&
            (0, runtime.countRecordNulls)(
              (0, runtime.deepMerge)(entry.server, state2.patch),
            ) > LIVE_MAX_PATCH_PROPERTY_COUNT,
          value26: Dynamic = timers.now();
        value23 = state2.replace
          ? {
              path: input,
              verb: "set",
              body: (0, runtime.removeNullValues)(value24),
              op: {
                patch: (0, runtime.removeNullValues)(value24),
                replace: true,
              },
              sent: value26,
            }
          : value25
            ? {
                path: input,
                verb: "set",
                body: (0, runtime.removeNullValues)(value24),
                op: state2,
                sent: value26,
              }
            : {
                path: input,
                verb: "update",
                body: state2.patch,
                op: state2,
                sent: value26,
              };
      }
      entry.inflight = value23.op;
      entry.inflightEchoed = false;
      inFlightWrites.set(input, value23);
      (value23.verb === "set"
        ? database.set(input, value23.body)
        : value23.verb === "update"
          ? database.update(input, value23.body)
          : database.del(input)
      ).then(
        (): Dynamic => handleWriteSuccess(value23),
        (input2?: Dynamic): Dynamic =>
          handleWriteFailure(
            value23,
            (0, runtime.normalizeDatabaseError)(input2),
          ),
      );
      return true;
    }
    function previewInflightValue(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      let inflight: Dynamic = options2.inflight;
      options2.inflight = context;
      let value23: Dynamic = effectivePathValue(input);
      options2.inflight = inflight;
      return value23;
    }
    function handleWriteSuccess(input?: Dynamic): Dynamic {
      if (flag15) return;
      let value23: Dynamic = ensurePathState(input.path);
      inFlightWrites.delete(input.path);
      value23.inflight = undefined;
      let value24: Dynamic = value23.inflightEchoed === true;
      value23.inflightEchoed = undefined;
      value23.failures = 0;
      flag14 = true;
      !flag7 &&
        flag4 &&
        !flag5 &&
        value7 === undefined &&
        ((flag5 = true),
        (index2 = 0),
        flag || refreshCollectionSnapshots(),
        value19());
      value14 = timers.now();
      value11 = value14;
      flag13 = false;
      clearRecoveredWriteError();
      let value25: Dynamic = timers.now();
      if (input.verb === "delete") {
        let value26: Dynamic = value23.server !== undefined || value23.exists;
        value23.exists = false;
        value26
          ? (value23.acked.push({
              patch: {},
              replace: false,
              del: true,
              at: value25,
              sent: input.sent,
              since: value25,
            }),
            scheduleStuckCheck(input.path))
          : (value23.acked = []);
      } else {
        (input.verb === "set" ||
          value23.server !== undefined ||
          !value23.removedSeen) &&
          ((value23.exists = true),
          (value23.goneNoticed = undefined),
          (value23.reAdd = undefined));
        if (
          value23.createBase !== undefined &&
          value23.createTheirs !== undefined &&
          input.verb === "set"
        ) {
          let value28: Dynamic = (0, runtime.deepMerge)(
              value23.createTheirs,
              rebaseReplacementPatch(
                value23.createBase,
                input.body,
                value23.createTheirs,
              ) ?? {},
            ),
            value29: Dynamic = (0, runtime.diffRecord)(input.body, value28);
          if (value29 !== null) {
            let pending: Dynamic = value23.pending;
            value23.pending =
              pending === undefined
                ? {
                    patch: value29,
                    replace: false,
                  }
                : pending.patch === runtime.DELETE_DOCUMENT || pending.replace
                  ? pending
                  : combinePendingPatches(value29, pending.patch, input.body);
            value23.pending !== undefined &&
              ((value23.due = true),
              value23.seq === 0 && (value23.seq = ++index4));
          }
        }
        value23.createBase = value23.createTheirs = undefined;
        let value26: Dynamic = input.verb === "set",
          value27: Dynamic =
            value23.acked.length === 0 &&
            value23.server !== undefined &&
            (value26
              ? (0, runtime.structurallyEqual)(value23.server, input.body)
              : containsServerPatch(value23.server, input.body));
        if (value24 || value27) {
          for (let value28 of value23.acked as Dynamic)
            advanceHeldBase(value23, value28);
          advanceHeldBase(value23, {
            patch: input.body,
            replace: value26,
            del: false,
            at: value25,
            sent: input.sent,
            since: value25,
          });
          value23.acked = [];
        } else if (
          (value23.acked.push({
            patch: input.body,
            replace: value26,
            del: false,
            at: value25,
            sent: input.sent,
            since: value25,
          }),
          scheduleStuckCheck(input.path),
          value23.acked.length > LIVE_MAX_ACKNOWLEDGED_WRITES)
        ) {
          let value28: Dynamic = value23.acked[0].del
              ? value23.acked.slice(0, 1)
              : [],
            [value29, value30, ...value31]: Dynamic = value23.acked.slice(
              value28.length,
            ),
            value32: Dynamic =
              value30.del || value30.replace || value29.del
                ? undefined
                : value29.replace
                  ? (0, runtime.deepMerge)(value29.patch, value30.patch)
                  : (0, runtime.mergeCompatibleRecords)(
                      value29.patch,
                      value30.patch,
                    ),
            value33: Dynamic =
              value29.replace &&
              value23.server === undefined &&
              value23.removedSeen &&
              value23.deliveredAt !== undefined &&
              value29.at <= value23.deliveredAt &&
              value23.deliveredAt < value30.at,
            state2: Dynamic = {
              sent: value29.sent,
              since: value29.since,
            },
            value34: Dynamic = value30.del
              ? {
                  patch: {},
                  replace: false,
                  del: true,
                  at: value30.at,
                  ...state2,
                }
              : value30.replace || value29.del
                ? {
                    patch: value30.patch,
                    replace: true,
                    del: false,
                    at: value30.at,
                    ...state2,
                  }
                : value32 != null
                  ? {
                      patch: value32,
                      replace: value29.replace,
                      del: false,
                      at: value33 ? value23.deliveredAt : value30.at,
                      ...state2,
                    }
                  : undefined;
          value34 !== undefined &&
            (value23.acked = [...value28, value34, ...value31]);
        }
      }
      value23.acked.length > 0 && scheduleAckPruning();
      parkedWrites.size === 0 && (value15 = undefined);
      updateEffectiveDocument(input.path) && composeDocument(true);
      releaseDeferredEcho(input.path, input.op);
      scheduleWriteFlush();
    }
    let value16: Dynamic;
    function acknowledgementDeadline(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      if (input.deliveredAt === undefined || input.deliveredAt < options2.sent)
        return;
      if (input.server !== undefined || !input.removedSeen)
        return options2.at + LIVE_WRITE_ACK_TIMEOUT_MS;
      if (
        flag ||
        (input.inflight !== undefined &&
          input.inflight.patch !== runtime.DELETE_DOCUMENT)
      )
        return;
      let value23: Dynamic = Math.max(input.deliveredAt, options2.at);
      for (let value24 of input.acked as Dynamic)
        !value24.del &&
          !value24.replace &&
          (value23 = Math.max(value23, value24.at));
      return value23 + LIVE_WRITE_ACK_TIMEOUT_MS;
    }
    function pruneAcknowledgedWrites(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      let length: Dynamic = options2.acked.length,
        callback5: Dynamic = (input2?: Dynamic): Dynamic =>
          (acknowledgementDeadline(options2, input2) ?? 1 / 0) <= context;
      for (let value23 of options2.acked as Dynamic)
        callback5(value23) && advanceHeldBase(options2, value23);
      options2.acked = options2.acked.filter(
        (input2?: Dynamic): Dynamic => !callback5(input2),
      );
      options2.server === undefined &&
        options2.removedSeen &&
        options2.exists &&
        (!options2.acked.some((input2?: Dynamic): Dynamic => input2.replace) ||
          options2.acked[options2.acked.length - 1].del) &&
        ((options2.exists = false),
        discardInvalidPending(input, options2, true) &&
          options2.goneNoticed !== true &&
          (options.onNotice?.(
            "An item you were editing was deleted by someone else.",
          ),
          (options2.goneNoticed = true)));
      return (
        options2.acked.length !== length &&
        !options2.held &&
        updateEffectiveDocument(input)
      );
    }
    function discardInvalidPending(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      return options2.pending === undefined ||
        options2.pending.patch === runtime.DELETE_DOCUMENT ||
        (options2.pending.replace && !context)
        ? false
        : (withdrawPendingWrite(input, options2), true);
    }
    function advanceHeldBase(input?: Dynamic, options2?: Dynamic): Dynamic {
      !input.held ||
        input.heldBase === undefined ||
        options2.del ||
        (input.heldBase =
          applyPendingPatch(input.heldBase ?? undefined, options2) ?? null);
    }
    function scheduleStuckCheck(input?: Dynamic): Dynamic {
      stuckListeners.size !== 0 &&
        timers.setTimeout((): Dynamic => {
          let entry: Dynamic = pathStates.get(input);
          if (
            flag15 ||
            value7 !== undefined ||
            flag ||
            loadState !== "live" ||
            entry === undefined ||
            entry.pending !== undefined ||
            entry.inflight !== undefined
          )
            return;
          let value23: Dynamic = entry.acked.reduce(
            (input2?: Dynamic, options2?: Dynamic): Dynamic =>
              input2 === undefined || options2.since < input2
                ? options2.since
                : input2,
            undefined,
          );
          if (
            value23 === undefined ||
            value23 > timers.now() - LIVE_STUCK_WRITE_TIMEOUT_MS ||
            entry.stuckSaid === value23
          )
            return;
          let value24: Dynamic = effectivePathValue(input),
            value25: Dynamic =
              entry.server === undefined
                ? entry.removedSeen && value24 !== undefined
                  ? "ghost"
                  : undefined
                : (0, runtime.structurallyEqual)(value24 ?? null, entry.server)
                  ? undefined
                  : "stale";
          if (value25 !== undefined) {
            entry.stuckSaid = value23;
            for (let value26 of [...stuckListeners] as Dynamic)
              value26(value25);
          }
        }, LIVE_STUCK_WRITE_TIMEOUT_MS + LIVE_FRAME_FALLBACK_DELAY_MS);
    }
    function scheduleAckPruning(): Dynamic {
      if (value16 !== undefined) return;
      let value23: Dynamic = 1 / 0,
        value24: Dynamic = timers.now();
      for (let value25 of pathStates.values() as Dynamic)
        for (let value26 of value25.acked as Dynamic)
          value23 = Math.min(
            value23,
            acknowledgementDeadline(value25, value26) ?? 1 / 0,
          );
      value23 !== 1 / 0 &&
        (value16 = timers.setTimeout(
          (): Dynamic => {
            value16 = undefined;
            let value25: Dynamic = timers.now(),
              flag19: Dynamic = false;
            for (let [value26, value27] of pathStates as Dynamic)
              value27.acked.length > 0 &&
                pruneAcknowledgedWrites(value26, value27, value25) &&
                (flag19 = true);
            flag19 && composeDocument(true);
            scheduleAckPruning();
          },
          Math.max(LIVE_FRAME_FALLBACK_DELAY_MS, value23 - value24),
        ));
    }
    function clearRecoveredWriteError(): Dynamic {
      [...pathStates.values()].some(
        (input?: Dynamic): Dynamic =>
          input.failures > 0 &&
          (input.pending !== undefined || input.inflight !== undefined),
      ) ||
        ((flag9 = false),
        (value13 = undefined),
        (index6 = 0),
        (value9 = undefined));
    }
    function withdrawPendingWrite(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      options2.pending = undefined;
      options2.parked = undefined;
      parkedWrites.delete(input);
      options2.failures = 0;
      options2.notBefore = 0;
      parkedWrites.size === 0 && (value15 = undefined);
      clearRecoveredWriteError();
    }
    function writeFailureBackoff(input?: Dynamic): Dynamic {
      return Math.min(
        LIVE_MAX_WRITE_RETRY_BACKOFF_MS,
        LIVE_WRITE_RETRY_INITIAL_BACKOFF_MS * 2 ** Math.max(0, input - 2),
      );
    }
    function restoreFailedWrite(input?: Dynamic, options2?: Dynamic): Dynamic {
      let pending: Dynamic = options2.pending;
      if (
        input.op.replace &&
        input.op.patch !== runtime.DELETE_DOCUMENT &&
        options2.createBase !== undefined &&
        options2.server !== undefined
      ) {
        let value23: Dynamic =
            pending !== undefined && pending.patch !== runtime.DELETE_DOCUMENT
              ? pending.replace
                ? pending.patch
                : (0, runtime.removeNullValues)(
                    (0, runtime.deepMerge)(input.op.patch, pending.patch),
                  )
              : input.op.patch,
          value24: Dynamic = rebaseReplacementPatch(
            options2.createBase,
            value23,
            options2.server,
          );
        options2.createBase = options2.createTheirs = undefined;
        options2.pending =
          pending !== undefined && pending.patch === runtime.DELETE_DOCUMENT
            ? pending
            : value24 === null
              ? undefined
              : {
                  patch: value24,
                  replace: false,
                };
        options2.pending !== undefined &&
          ((options2.due = true),
          options2.seq === 0 && (options2.seq = ++index4));
        return;
      }
      if (input.op.patch === runtime.DELETE_DOCUMENT)
        pending === undefined && (options2.pending = input.op);
      else if (pending === undefined) options2.pending = input.op;
      else if (pending.patch !== runtime.DELETE_DOCUMENT)
        if (pending.replace) options2.pending = pending;
        else if (input.op.replace)
          options2.pending = {
            patch: (0, runtime.removeNullValues)(
              (0, runtime.deepMerge)(input.op.patch, pending.patch),
            ),
            replace: true,
          };
        else {
          let server: Dynamic = options2.server;
          for (let value23 of options2.acked as Dynamic)
            server = value23.del
              ? undefined
              : applyPendingPatch(server, value23);
          options2.pending = combinePendingPatches(
            input.op.patch,
            pending.patch,
            server,
          );
          options2.pending === undefined &&
            withdrawPendingWrite(input.path, options2);
        }
      options2.pending !== undefined &&
        ((options2.due = true),
        options2.seq === 0 && (options2.seq = ++index4));
    }
    function handleWriteFailure(input?: Dynamic, options2?: Dynamic): Dynamic {
      if (flag15) return;
      let value23: Dynamic = ensurePathState(input.path),
        entry: Dynamic = entries.get(input.path),
        value24: Dynamic =
          options2.code === "unavailable" ||
          options2.code === "resource_exhausted";
      entry?.type === "removed"
        ? (entries.delete(input.path), items.push(entry), applyServerChanges())
        : value24 || entries.delete(input.path);
      inFlightWrites.delete(input.path);
      value23.inflight = undefined;
      value23.inflightEchoed = undefined;
      let value25: Dynamic = timers.now();
      if (runtime.DATABASE_ACCESS_DENIED_CODES.includes(options2.code)) {
        restoreFailedWrite(input, value23);
        return endLiveSync(options2);
      }
      (options2.code === "unavailable" ||
        options2.code === "resource_exhausted") &&
        (flag13 = true);
      if (options2.code === "unavailable") {
        value23.failures += 1;
        restoreFailedWrite(input, value23);
        if (value23.pending !== undefined)
          if (value23.failures === 1) {
            let [value26, value27]: Dynamic = LIVE_CONFLICT_RETRY_MS;
            value23.notBefore =
              value25 + value26 + timers.random() * (value27 - value26);
          } else {
            flag9 = true;
            value23.notBefore = value25 + writeFailureBackoff(value23.failures);
            value13 = value23.notBefore;
            value15 = {
              code: options2.code,
              message: options2.message,
              path: input.path,
            };
          }
      } else
        options2.code === "resource_exhausted"
          ? (restoreFailedWrite(input, value23),
            value23.pending !== undefined &&
              ((index6 += 1),
              (index5 =
                value25 +
                Math.min(
                  LIVE_RETRY_MAX_BACKOFF_MS,
                  LIVE_RETRY_INITIAL_BACKOFF_MS * 2 ** (index6 - 1),
                )),
              (value9 ??= value25),
              (value15 = {
                code: options2.code,
                message: options2.message,
                path: input.path,
              })))
          : options2.code === "invalid_argument" &&
              input.verb === "update" &&
              value23.removedSeen &&
              value23.server === undefined
            ? (value23.pending !== undefined &&
              (value23.pending.patch === runtime.DELETE_DOCUMENT ||
                (value23.pending.replace && !value23.exists))
                ? ((value23.failures = 0), clearRecoveredWriteError())
                : withdrawPendingWrite(input.path, value23),
              (value23.exists = false),
              (value23.acked = []),
              updateEffectiveDocument(input.path) && composeDocument(true),
              value23.goneNoticed !== true &&
                options.onNotice?.(
                  "An item you were editing was deleted by someone else.",
                ),
              (value23.goneNoticed = true))
            : parkRejectedWrite(input, value23, options2);
      value23.pending === undefined && entries.delete(input.path);
      updateEffectiveDocument(input.path) && composeDocument(true);
      value23.acked.length > 0 && scheduleAckPruning();
      scheduleWriteFlush();
    }
    function parkRejectedWrite(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      restoreFailedWrite(input, options2);
      if (options2.pending === undefined) return;
      let value23: Dynamic = effectivePathValue(input.path),
        value24: Dynamic =
          (value23 !== undefined
            ? codec.refuse?.(
                input.path,
                value23,
                collectionContentSize((0, runtime.dirname)(input.path)),
              )
            : undefined) ??
          "This change can\u2019t be stored (" + context.message + ").";
      options2.parked = value24;
      parkedWrites.set(input.path, value24);
      value15 = {
        code: context.code,
        message: value24,
        path: input.path,
      };
    }
    function retryParkedWrites(): Dynamic {
      for (let [value23, value24] of pathStates as Dynamic)
        value24.parked !== undefined &&
          ((value24.parked = undefined),
          parkedWrites.delete(value23),
          validatePendingWrite(value23, value24),
          value24.parked === undefined && (value24.due = true));
    }
    function flushPendingNow(): Dynamic {
      flag8 && decomposeChanges();
      let value23: Dynamic = timers.now();
      for (let value24 of pathStates.values() as Dynamic)
        value24.pending !== undefined &&
          ((value24.due = true),
          (value24.notBefore = Math.min(value24.notBefore, value23)));
      index5 = 0;
      scheduleWriteFlush();
    }
    function endLiveSync(input?: Dynamic): Dynamic {
      if (value7 === undefined) {
        unsubscribeCollections();
        clearTimers();
        if (!flag10) {
          flag15 = true;
          removeLifecycleListeners();
          options.onStoreUnavailable(
            input.code + (input.message ? ": " + input.message : ""),
          );
          return;
        }
        value7 = input;
        loadState === "cached" && (flag12 = true);
        for (let value23 of [...loadListeners] as Dynamic) value23();
        options.onNotice?.(
          "Live sync ended for this view. Reload the page to continue editing.",
        );
        notifyContent(false);
      }
    }
    function clearTimers(): Dynamic {
      for (let value23 of [
        value8,
        value2,
        value16,
        value18,
        value5,
        value4,
        value10,
        value17,
        value12,
      ] as Dynamic)
        value23 !== undefined && timers.clearTimeout(value23);
      value8 =
        value2 =
        value16 =
        value18 =
        value5 =
        value4 =
        value10 =
        value17 =
        value12 =
          undefined;
    }
    let items: Dynamic = [],
      flag16: Dynamic = false,
      flag17: Dynamic = false,
      flag18: Dynamic = false,
      value17: Dynamic,
      index7: Dynamic = 0,
      entries: Dynamic = new Map(),
      entries2: Dynamic = new Map();
    function deferPendingServerEcho(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      if (!options2.hasPendingWrites || !inFlightWrites.has(input.path))
        return false;
      if (
        input.type === "removed" &&
        inFlightWrites.get(input.path).verb !== "delete"
      ) {
        entries.delete(input.path);
        return false;
      }
      entries.set(input.path, input);
      entries2.set(input.path, inFlightWrites.get(input.path).op);
      let entry: Dynamic = pathStates.get(input.path),
        value23: Dynamic = entry?.inflight;
      entry !== undefined &&
        entry.createBase !== undefined &&
        input.type !== "removed" &&
        value23 !== undefined &&
        value23.patch !== runtime.DELETE_DOCUMENT &&
        value23.replace &&
        !(0, runtime.structurallyEqual)(input.data ?? {}, value23.patch) &&
        (entry.createTheirs = input.data ?? {});
      return true;
    }
    function releaseDeferredEcho(input?: Dynamic, options2?: Dynamic): Dynamic {
      let entry: Dynamic = entries.get(input),
        entry2: Dynamic = entries2.get(input);
      entries.delete(input);
      entries2.delete(input);
      entry !== undefined &&
        ((entry2 !== undefined && !equalPendingOperations(entry2, options2)) ||
          (items.push(entry), applyServerChanges()));
    }
    function equalPendingOperations(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      return input === options2
        ? true
        : input.patch === runtime.DELETE_DOCUMENT ||
            options2.patch === runtime.DELETE_DOCUMENT
          ? input.patch === options2.patch
          : input.replace === options2.replace &&
            (0, runtime.structurallyEqual)(input.patch, options2.patch);
    }
    function handleCollectionSnapshot(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      if (flag15 || value7 !== undefined) return;
      flag && collectionSubscriptions.length > 0 && !context.fromCache
        ? ((flag = false),
          (index8 = 0),
          value18 !== undefined &&
            (timers.clearTimeout(value18), (value18 = undefined)),
          (flag17 = true),
          loadState === "cached" && flag12 && scheduleCachedReconnect())
        : flag &&
          collectionSubscriptions.length > 0 &&
          value18 !== undefined &&
          !flag18 &&
          ((flag18 = true),
          scheduleReconnectTimeout(LIVE_EXTENDED_LOAD_TIMEOUT_MS));
      let value23: Dynamic = (
        context.fromCache
          ? options2.map(
              (input2?: Dynamic): Dynamic => ({
                ...input2,
                cached: true,
              }),
            )
          : options2
      ).filter(
        (input2?: Dynamic): Dynamic => !deferPendingServerEcho(input2, context),
      );
      for (let value25 of options2 as Dynamic)
        (!context.hasPendingWrites || !inFlightWrites.has(value25.path)) &&
          entries.delete(value25.path);
      for (let value25 of value23 as Dynamic) items.push(value25);
      context.fromCache ? (flag2 = true) : loadedCollections.add(input);
      if (context.fromCache) values3.add(input);
      else if (values3.delete(input)) {
        let value25: Dynamic = timers.now();
        for (let [value26, value27] of pathStates as Dynamic)
          (0, runtime.dirname)(value26) === input &&
            (value27.deliveredAt = value25);
      }
      values2.add(input);
      context.hasPendingWrites ? values.add(input) : values.delete(input);
      value23.some((input2?: Dynamic): Dynamic => input2.type !== "removed") &&
        (flag7 = true);
      !flag3 &&
        value23.some(
          (input2?: Dynamic): Dynamic =>
            input2.type !== "removed" && input2.path === metaPath,
        ) &&
        ((flag3 = true), scheduleReconnectRecovery());
      (loadState === "loading" || loadState === "failed") &&
        scheduleInitialLoadTimeout();
      let value24: Dynamic = value3?.get(input);
      if (value24 !== undefined) {
        for (let value25 of options2 as Dynamic)
          value25.type === "removed"
            ? value24.delete(value25.path)
            : value24.add(value25.path);
        context.fromCache || reconcileRemovedDocuments(input, value24);
      }
      index = timers.now();
      flag16 || ((flag16 = true), queueMicrotask(applyServerChanges));
    }
    function resolveNestedServerPatch(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value23: Dynamic = [],
    ): Dynamic {
      let value24: Dynamic,
        index9: Dynamic = 0;
      for (let value25 of Object.keys(context) as Dynamic) {
        let value26: Dynamic = context[value25],
          value27: Dynamic = input[value25],
          value28: Dynamic = options2[value25];
        if (
          (0, runtime.isPlainRecord)(value26) &&
          (0, runtime.isPlainRecord)(value27) &&
          !(0, runtime.isPlainRecord)(value28)
        ) {
          if (pendingWritesObjectField(value23, value25)) {
            index9 += 1;
            continue;
          }
          value24 ??= {
            ...context,
          };
          delete value24[value25];
          continue;
        }
        if (
          (0, runtime.isPlainRecord)(value26) &&
          (0, runtime.isPlainRecord)(value27) &&
          (0, runtime.isPlainRecord)(value28)
        ) {
          let value29: Dynamic = resolveNestedServerPatch(
            value27,
            value28,
            value26,
            pendingFieldPatches(value23, value25),
          );
          value29 !== value26 &&
            ((value24 ??= {
              ...context,
            }),
            value29 === undefined
              ? delete value24[value25]
              : (value24[value25] = value29));
          value29 !== undefined && (index9 += 1);
          continue;
        }
        index9 += 1;
      }
      return value24 === undefined ? context : index9 > 0 ? value24 : undefined;
    }
    function pendingWritesObjectField(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      let flag19: Dynamic = false;
      for (let value23 of input as Dynamic)
        (value23.replace || Object.hasOwn(value23.patch, options2)) &&
          (flag19 = !(0, runtime.isPlainRecord)(value23.patch[options2]));
      return flag19;
    }
    function pendingFieldPatches(input?: Dynamic, options2?: Dynamic): Dynamic {
      let items2: Dynamic = [];
      for (let value23 of input as Dynamic) {
        let value24: Dynamic = value23.patch[options2];
        (0, runtime.isPlainRecord)(value24)
          ? items2.push({
              patch: value24,
              replace: value23.replace,
            })
          : (value23.replace || Object.hasOwn(value23.patch, options2)) &&
            items2.push({
              patch: {},
              replace: true,
            });
      }
      return items2;
    }
    function containsServerPatch(input?: Dynamic, options2?: Dynamic): Dynamic {
      for (let value23 of Object.keys(options2) as Dynamic) {
        let value24: Dynamic = options2[value23],
          value25: Dynamic = input[value23];
        if (value24 === null) {
          if (value25 != null) return false;
        } else if (
          (0, runtime.isPlainRecord)(value24) &&
          (0, runtime.isPlainRecord)(value25)
        ) {
          if (!containsServerPatch(value25, value24)) return false;
        } else if (!(0, runtime.structurallyEqual)(value24, value25))
          return false;
      }
      return true;
    }
    function applyServerChanges(): Dynamic {
      flag16 = false;
      let value23: Dynamic = items;
      items = [];
      if (flag15 || value7 !== undefined) return;
      let values4: Dynamic = new Set(),
        value24: Dynamic = timers.now(),
        flag19: Dynamic = false;
      for (let value25 of value23 as Dynamic) {
        let value26: Dynamic = ensurePathState(value25.path);
        (!value25.cached || value25.type === "removed") &&
          (value26.deliveredAt = value24);
        if (value25.type === "removed") {
          let exists: Dynamic = value26.exists;
          value26.server = undefined;
          value26.removedSeen = true;
          value26.createBase =
            value26.createTheirs =
            value26.heldBase =
              undefined;
          let value27: Dynamic = value26.acked.findIndex(
            (input?: Dynamic): Dynamic =>
              input.del && value24 - input.at < LIVE_WRITE_ACK_TIMEOUT_MS,
          );
          if (loadedMetadataCollections.delete(value25.path) && value27 < 0)
            for (
              let index9: Dynamic = 0;
              index9 < value26.acked.length;
              index9++
            )
              value26.acked[index9].del && (value27 = index9);
          let value28: Dynamic =
            value27 >= 0 || value26.inflight?.patch === runtime.DELETE_DOCUMENT;
          value26.acked = value27 < 0 ? [] : value26.acked.slice(value27 + 1);
          value26.exists =
            value26.acked.length > 0 &&
            !value26.acked[value26.acked.length - 1].del;
          !(
            value28 &&
            (value26.exists ||
              (value26.inflight !== undefined &&
                value26.inflight.patch !== runtime.DELETE_DOCUMENT &&
                value26.inflight.replace))
          ) &&
            discardInvalidPending(
              value25.path,
              value26,
              exists &&
                !value28 &&
                value26.reAdd !== true &&
                value25.path !== metaPath,
            ) &&
            ((flag19 = true), (value26.goneNoticed = true));
        } else {
          let server: Dynamic = value26.server;
          value26.server = value25.data ?? {};
          value26.exists = true;
          value25.cached || (value26.reAdd = undefined);
          value26.removedSeen = false;
          value26.goneNoticed = undefined;
          let server2: Dynamic = value26.server,
            inflight: Dynamic = value26.inflight,
            flag21: Dynamic = false;
          inflight !== undefined &&
            inflight.patch !== runtime.DELETE_DOCUMENT &&
            value26.inflightEchoed !== true &&
            ((value26.inflightEchoed = inflight.replace
              ? (0, runtime.structurallyEqual)(server2, inflight.patch)
              : containsServerPatch(server2, inflight.patch)),
            (flag21 = value26.inflightEchoed === true));
          if (value26.createBase !== undefined)
            if (value26.inflightEchoed === true)
              value26.createTheirs === undefined &&
                (value26.createBase = undefined);
            else if (
              inflight !== undefined ||
              value26.pending === undefined ||
              value26.pending.patch === runtime.DELETE_DOCUMENT ||
              !value26.pending.replace
            )
              inflight !== undefined
                ? (value26.createTheirs = server2)
                : (value26.createBase = undefined);
            else {
              let value28: Dynamic = rebaseReplacementPatch(
                value26.createBase,
                value26.pending.patch,
                server2,
              );
              value26.createBase = undefined;
              value28 === null
                ? withdrawPendingWrite(value25.path, value26)
                : (value26.pending = {
                    patch: value28,
                    replace: false,
                  });
            }
          let items2: Dynamic = [],
            value27: Dynamic =
              inflight !== undefined &&
              inflight.patch !== runtime.DELETE_DOCUMENT
                ? {
                    patch: inflight.patch,
                    replace: inflight.replace,
                    del: false,
                    at: 0,
                    sent: 0,
                    since: 0,
                  }
                : undefined;
          if (value26.inflightEchoed === true) {
            items2 =
              value27 !== undefined
                ? [...value26.acked, value27]
                : value26.acked;
            value26.acked = [];
          } else {
            let value28: Dynamic = -1;
            value26.acked.forEach(
              (input?: Dynamic, options2?: Dynamic): Dynamic => {
                !input.del &&
                  (input.replace
                    ? (0, runtime.structurallyEqual)(server2, input.patch)
                    : containsServerPatch(server2, input.patch)) &&
                  (value28 = options2);
              },
            );
            value28 >= 0 &&
              ((items2 = value26.acked.slice(0, value28 + 1)),
              (value26.acked = value26.acked.slice(value28 + 1)));
          }
          if (
            server !== undefined &&
            value26.pending !== undefined &&
            value26.pending.patch !== runtime.DELETE_DOCUMENT &&
            !value26.pending.replace
          ) {
            let value28: Dynamic = items2.filter(
                (input?: Dynamic): Dynamic =>
                  !input.del && (input !== value27 || flag21),
              ),
              value29: Dynamic = resolveNestedServerPatch(
                server,
                server2,
                value26.pending.patch,
                value28,
              );
            value29 !== value26.pending.patch &&
              ((flag19 = true),
              value29 === undefined
                ? withdrawPendingWrite(value25.path, value26)
                : (value26.pending = {
                    patch: value29,
                    replace: false,
                  }));
          }
          let held: Dynamic = value26.held;
          value26.held =
            isLoaded() &&
            options.holdRemote?.(value25.path, value26.server) === true;
          value26.held &&
            (!held || value26.heldBase === undefined) &&
            (value26.heldBase =
              server ?? effectiveDocuments.get(value25.path) ?? null);
          if (value26.held)
            for (let value28 of items2 as Dynamic)
              advanceHeldBase(value26, value28);
          else value26.heldBase = undefined;
        }
        values4.add(value25.path);
      }
      loadedMetadataCollections.clear();
      flag19 &&
        isLoaded() &&
        options.onNotice?.(
          "An item you were editing was deleted by someone else.",
        );
      for (let value25 of value23 as Dynamic) {
        if (value25.type !== "removed") continue;
        let entry: Dynamic = pathStates.get(value25.path);
        entry &&
          entry.pending === undefined &&
          entry.inflight === undefined &&
          entry.acked.length === 0 &&
          !effectiveDocuments.has(value25.path) &&
          pathStates.delete(value25.path);
      }
      value16 !== undefined &&
        (timers.clearTimeout(value16), (value16 = undefined));
      scheduleAckPruning();
      if (loadState !== "live") {
        loadState === "failed" && setLoadState("loading");
        if (
          collections.every(
            (input?: Dynamic): Dynamic => loadedCollections.has(input),
          )
        ) {
          enterLiveMode();
          return resumeWritesAfterSnapshot();
        }
        if (loadState !== "cached") return;
      }
      let flag20: Dynamic = false;
      for (let value25 of values4 as Dynamic)
        pathStates.get(value25)?.held ||
          (updateEffectiveDocument(value25) && (flag20 = true));
      flag8 && decomposeChanges();
      flag20 ? composeDocument(true) : notifySaveState();
      resumeWritesAfterSnapshot();
    }
    function resumeWritesAfterSnapshot(): Dynamic {
      flag17 && ((flag17 = false), scheduleWriteFlush());
    }
    function refreshEffectiveDocuments(): Dynamic {
      let flag19: Dynamic = false,
        values4: Dynamic = new Set([
          ...pathStates.keys(),
          ...effectiveDocuments.keys(),
        ]);
      for (let value23 of values4 as Dynamic)
        pathStates.get(value23)?.held ||
          (updateEffectiveDocument(value23) && (flag19 = true));
      return flag19;
    }
    function enterCachedMode(): Dynamic {
      value2 !== undefined &&
        (timers.clearTimeout(value2), (value2 = undefined));
      flag8 && decomposeChanges();
      loadState = "cached";
      flag10 = true;
      value10 = timers.setTimeout((): Dynamic => {
        value10 = undefined;
        if (!(loadState !== "cached" || flag15)) {
          flag12 = true;
          for (let value23 of [...loadListeners] as Dynamic) value23();
          scheduleCachedReconnect();
        }
      }, LIVE_EXTENDED_LOAD_TIMEOUT_MS - LIVE_INITIAL_LOAD_TIMEOUT_MS);
      refreshEffectiveDocuments();
      composeDocument(true);
      for (let value23 of [...loadListeners] as Dynamic) value23();
    }
    function composeCachedSnapshot(): Dynamic {
      if (
        !flag2 ||
        !flag3 ||
        !collections.every((input?: Dynamic): Dynamic => values2.has(input))
      )
        return false;
      let entries3: Dynamic = new Map();
      for (let value23 of pathStates.keys() as Dynamic) {
        let value24: Dynamic = effectivePathValue(value23);
        value24 !== undefined &&
          entries3.set(value23, (0, runtime.removeNullValues)(value24));
      }
      try {
        return codec
          .compose(entries3, undefined)
          .dangling.every(
            (input?: Dynamic): Dynamic =>
              pathStates.get(input)?.removedSeen === true,
          );
      } catch {
        return false;
      }
    }
    function enterLiveMode(): Dynamic {
      value2 !== undefined &&
        (timers.clearTimeout(value2), (value2 = undefined));
      flag8 && decomposeChanges();
      flag10 = true;
      value10 !== undefined &&
        (timers.clearTimeout(value10), (value10 = undefined));
      value17 !== undefined &&
        (timers.clearTimeout(value17), (value17 = undefined));
      index7 = 0;
      value6 === undefined && (value6 = timers.now());
      loadState = "live";
      flag3 || value19();
      refreshEffectiveDocuments();
      composeDocument(true);
      for (let value23 of [...loadListeners] as Dynamic) value23();
    }
    let value18: Dynamic,
      index8: Dynamic = 0;
    function clearReconnectTimer(): Dynamic {
      value5 !== undefined && timers.clearTimeout(value5);
      value5 = undefined;
    }
    function reconnectDelay(): Dynamic {
      let value23: Dynamic =
          LIVE_RECONNECT_BACKOFF_MS[
            Math.min(index2, LIVE_RECONNECT_BACKOFF_MS.length - 1)
          ],
        value24: Dynamic =
          typeof document !== "undefined" &&
          (document as Dynamic).visibilityState === "hidden";
      return !flag7 &&
        !value24 &&
        value6 !== undefined &&
        timers.now() - value6 < LIVE_RECENT_RECONNECT_WINDOW_MS
        ? Math.min(value23, LIVE_RECENT_RECONNECT_DELAY_MS)
        : value23;
    }
    function value19(input: Dynamic = reconnectDelay()): Dynamic {
      clearReconnectTimer();
      !(!callback() || flag15 || value7 !== undefined) &&
        (flag3 || (flag4 = true),
        (value5 = timers.setTimeout((): Dynamic => {
          value5 = undefined;
          if (!callback() || flag15 || value7 !== undefined) return;
          let value23: Dynamic =
            typeof document !== "undefined" &&
            (document as Dynamic).visibilityState === "hidden";
          loadState === "live" &&
            !flag &&
            !value23 &&
            ((index2 += 1),
            flag7 && (index3 += 1),
            refreshCollectionSnapshots());
          value19();
        }, input)));
    }
    function scheduleReconnectRecovery(): Dynamic {
      flag4 &&
        ((flag4 = false),
        clearReconnectTimer(),
        (value4 = timers.setTimeout((): Dynamic => {
          value4 = undefined;
          !flag15 &&
            value7 === undefined &&
            loadState === "live" &&
            !flag &&
            refreshCollectionSnapshots();
          index2 = 0;
          flag6 && value19();
        }, 250)));
    }
    function subscribeCollections(): Dynamic {
      unsubscribeCollections();
      loadedCollections.clear();
      values2.clear();
      values.clear();
      let value23: Dynamic = subscriptionGeneration;
      collectionSubscriptions = collections.map(
        (input?: Dynamic): Dynamic =>
          database.subscribe(
            input,
            (input2?: Dynamic, options2?: Dynamic): Dynamic => {
              value23 === subscriptionGeneration &&
                handleCollectionSnapshot(input, input2, options2);
            },
            (input2?: Dynamic): Dynamic => {
              value23 === subscriptionGeneration && handleStoreError(input2);
            },
          ),
      );
      loadState === "loading" && scheduleInitialLoadTimeout();
    }
    function scheduleInitialLoadTimeout(): Dynamic {
      value2 !== undefined && timers.clearTimeout(value2);
      value2 = timers.setTimeout(
        (): Dynamic => {
          value2 = undefined;
          if (loadState === "loading") {
            if (composeCachedSnapshot()) return enterCachedMode();
            if (flag2 && !flag11) {
              flag11 = true;
              return scheduleInitialLoadTimeout();
            }
            value15 = {
              code: "timeout",
              message: "initial snapshots did not arrive",
            };
            setLoadState("failed");
          }
        },
        flag11
          ? LIVE_EXTENDED_LOAD_TIMEOUT_MS - LIVE_INITIAL_LOAD_TIMEOUT_MS
          : LIVE_INITIAL_LOAD_TIMEOUT_MS,
      );
    }
    function unsubscribeCollections(): Dynamic {
      subscriptionGeneration += 1;
      for (let value23 of collectionSubscriptions as Dynamic) value23();
      collectionSubscriptions = [];
      value18 !== undefined &&
        (timers.clearTimeout(value18), (value18 = undefined));
    }
    function handleStoreError(input?: Dynamic): Dynamic {
      if (!flag15) {
        if (runtime.DATABASE_ACCESS_DENIED_CODES.includes(input.code))
          return endLiveSync(input);
        if (loadState !== "failed") {
          value15 = {
            code: input.code,
            message: input.message,
          };
          unsubscribeCollections();
          if (loadState === "loading") {
            value2 !== undefined && timers.clearTimeout(value2);
            value2 = undefined;
            setLoadState("failed");
            return;
          }
          flag = true;
          index8 += 1;
          value18 = timers.setTimeout(
            (): Dynamic => {
              value18 = undefined;
              !(flag15 || value7 !== undefined || !flag) &&
                restartSubscriptions();
            },
            Math.min(
              LIVE_MAX_WRITE_RETRY_BACKOFF_MS,
              LIVE_WRITE_RETRY_INITIAL_BACKOFF_MS * 2 ** (index8 - 1),
            ),
          );
          notifySaveState();
        }
      }
    }
    function refreshCollectionSnapshots(): Dynamic {
      value3 = new Map(
        collections.map((input?: Dynamic): Dynamic => [input, new Set()]),
      );
      subscribeCollections();
    }
    function restartSubscriptions(): Dynamic {
      value3 = new Map(
        collections.map((input?: Dynamic): Dynamic => [input, new Set()]),
      );
      subscribeCollections();
      flag18 = false;
      scheduleReconnectTimeout(LIVE_INITIAL_LOAD_TIMEOUT_MS);
      notifySaveState();
      scheduleWriteFlush();
    }
    function scheduleReconnectTimeout(input?: Dynamic): Dynamic {
      value18 !== undefined && timers.clearTimeout(value18);
      value18 = timers.setTimeout((): Dynamic => {
        value18 = undefined;
        !(!flag || flag15 || value7 !== undefined) &&
          ((flag = false),
          handleStoreError({
            code: "unavailable",
            message: "re-subscribe stayed silent",
          }));
      }, input);
    }
    function reconcileRemovedDocuments(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      value3.delete(input);
      let value23: Dynamic = timers.now();
      for (let [value24, value25] of pathStates as Dynamic) {
        if (
          (0, runtime.dirname)(value24) !== input ||
          value25.server === undefined ||
          options2.has(value24)
        )
          continue;
        let value26: Dynamic = -1;
        for (let index9: Dynamic = 0; index9 < value25.acked.length; index9++)
          value25.acked[index9].del && (value26 = index9);
        let value27: Dynamic =
            (value25.inflight !== undefined &&
              value25.inflight.patch !== runtime.DELETE_DOCUMENT) ||
            (value25.pending !== undefined &&
              value25.pending.patch !== runtime.DELETE_DOCUMENT &&
              value25.parked === undefined),
          value28: Dynamic =
            (value26 >= 0 && value27) ||
            value25.acked.some(
              (input2?: Dynamic, options3?: Dynamic): Dynamic =>
                options3 > value26 &&
                (input2.replace || value26 >= 0) &&
                value23 - input2.at < LIVE_WRITE_ACK_TIMEOUT_MS,
            );
        value28 && value26 >= 0 && loadedMetadataCollections.add(value24);
        !(value25.inflight !== undefined || (value28 && value26 < 0)) &&
          (items.some(
            (input2?: Dynamic): Dynamic =>
              input2.type === "removed" && input2.path === value24,
          ) ||
            items.push({
              type: "removed",
              path: value24,
            }));
      }
      value3.size === 0 && (value3 = undefined);
    }
    function retryLiveSync(): Dynamic {
      flag15 ||
        value7 !== undefined ||
        (loadState === "failed"
          ? ((flag2 = false),
            (flag11 = false),
            setLoadState("loading"),
            subscribeCollections())
          : flag
            ? restartSubscriptions()
            : loadState === "cached" &&
              flag12 &&
              ((index7 = 0),
              refreshCollectionSnapshots(),
              scheduleCachedReconnect()));
    }
    function scheduleCachedReconnect(): Dynamic {
      value17 !== undefined && timers.clearTimeout(value17);
      let value23: Dynamic =
        LIVE_RECONNECT_BACKOFF_MS[
          Math.min(index7, LIVE_RECONNECT_BACKOFF_MS.length - 1)
        ];
      value17 = timers.setTimeout((): Dynamic => {
        value17 = undefined;
        !(loadState !== "cached" || flag15 || value7 !== undefined || flag) &&
          ((index7 += 1),
          refreshCollectionSnapshots(),
          scheduleCachedReconnect());
      }, value23);
    }
    function releaseHeldDocument(input?: Dynamic): Dynamic {
      let entry: Dynamic = pathStates.get(input);
      entry === undefined ||
        !entry.held ||
        ((entry.held = false),
        (entry.heldBase = undefined),
        updateEffectiveDocument(input),
        composeDocument(true));
    }
    let callback2: Dynamic = (): Dynamic => {
        if (
          typeof document !== "undefined" &&
          (document as Dynamic).visibilityState === "visible"
        ) {
          value5 !== undefined && value19(LIVE_RECONNECT_BACKOFF_MS[0]);
          return;
        }
        flushPendingNow();
      },
      callback3: Dynamic = (): Dynamic => flushPendingNow(),
      callback4: Dynamic = (event?: Dynamic): Dynamic => {
        (pendingWriteCount() === 0 && inFlightWrites.size === 0) ||
          (event.preventDefault(), (event.returnValue = ""));
      },
      value20: Dynamic =
        typeof document !== "undefined" &&
        typeof (document as Dynamic).addEventListener == "function";
    typeof addEventListener == "function" &&
      (value20 &&
        (document as Dynamic).addEventListener("visibilitychange", callback2),
      addEventListener("pagehide", callback3),
      canWrite && addEventListener("beforeunload", callback4));
    let value21: Dynamic = canWrite
      ? registerLiveDocumentFlusher({
          dirty: (): Dynamic =>
            pendingWriteCount() > 0 || inFlightWrites.size > 0,
          flushNow: flushPendingNow,
        })
      : undefined;
    function removeLifecycleListeners(): Dynamic {
      value21?.();
      typeof removeEventListener == "function" &&
        (value20 &&
          (document as Dynamic).removeEventListener(
            "visibilitychange",
            callback2,
          ),
        removeEventListener("pagehide", callback3),
        removeEventListener("beforeunload", callback4));
    }
    subscribeCollections();
    let value22: Dynamic = runtime.CommentsValue + "/";
    function unsavedFilePaths(): Dynamic {
      let items2: Dynamic = [];
      for (let [value23, value24] of pathStates as Dynamic)
        value23.startsWith(value22) &&
          (value24.pending !== undefined || value24.inflight !== undefined) &&
          items2.push(value23);
      return items2;
    }
    return {
      saveMode: (): Dynamic => "auto",
      state: (): Dynamic => state,
      content: (): Dynamic => state.content,
      title: (): Dynamic => state.title,
      comments: (): Dynamic => state.comments,
      dirty: (): Dynamic => pendingWriteCount() > 0 || inFlightWrites.size > 0,
      readOnly: (): Dynamic => !canWrite || value7 !== undefined,
      saveState: getSaveState,
      commentSync(): Dynamic {
        let value23: Dynamic = unsavedFilePaths(),
          value24: Dynamic = [...parkedWrites.keys()].find(
            (input?: Dynamic): Dynamic => input.startsWith(value22),
          );
        return value24 !== undefined
          ? {
              status: "error",
              pending: value23.length,
              message: parkedWrites.get(value24),
            }
          : value23.length > 0
            ? {
                status: "publishing",
                pending: value23.length,
              }
            : {
                status: "idle",
                pending: 0,
              };
      },
      pendingCommentIds(): Dynamic {
        return new Set(
          unsavedFilePaths().map(
            (input?: Dynamic): Dynamic => input.slice(value22.length),
          ),
        );
      },
      retryCommentPublish(): Dynamic {
        retryParkedWrites();
        flushPendingNow();
      },
      setContent(input: Dynamic): Dynamic {
        input !== state.content &&
          (changeDocument({
            ...state,
            content: input,
          }),
          (0, runtime.recordEdit)());
      },
      updateContent(input: Dynamic, options2: Dynamic): Dynamic {
        let value23: Dynamic = input(state.content);
        value23 !== state.content &&
          (changeDocument({
            ...state,
            content: value23,
          }),
          options2?.auto !== true && (0, runtime.recordEdit)());
      },
      setTitle(input: Dynamic): Dynamic {
        let value23: Dynamic = (0, runtime.normalizeNewDocumentTitle)(input);
        value23.length === 0 ||
          value23 === state.title ||
          (changeDocument({
            ...state,
            title: value23,
          }),
          (0, runtime.recordEdit)());
      },
      addComment(input: Dynamic): Dynamic {
        if (state.comments.length >= runtime.maxDocumentComments) return;
        let value23: Dynamic = (0, runtime.parseDocumentComments)([
          {
            ...input,
            id: crypto.randomUUID().slice(0, 8),
            at: Date.now(),
          },
        ])[0];
        if (value23) {
          changeDocument({
            ...state,
            comments: [...state.comments, value23].sort(
              (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                input2.at - options2.at,
            ),
          });
          return value23;
        }
      },
      removeComment(input: Dynamic): Dynamic {
        state.comments.some(
          (input2?: Dynamic): Dynamic => input2.id === input,
        ) &&
          changeDocument({
            ...state,
            comments: state.comments.filter(
              (input2?: Dynamic): Dynamic => input2.id !== input,
            ),
          });
      },
      documentBytes(): Dynamic {
        let index9: Dynamic = 0;
        for (let value23 of documentSizes.values() as Dynamic)
          index9 += value23;
        return index9;
      },
      async save(): Promise<Dynamic> {
        (loadState === "failed" ||
          flag ||
          (loadState === "cached" && flag12)) &&
          retryLiveSync();
        retryParkedWrites();
        flushPendingNow();
      },
      stashOffer: (): Dynamic => {},
      restoreStash: (): Dynamic => {},
      discardStash: (): Dynamic => {},
      restoreCount: (): Dynamic => 0,
      subscribe(input: Dynamic): Dynamic {
        contentListeners.add(input);
        return (): Dynamic => contentListeners.delete(input);
      },
      subscribeSave(input: Dynamic): Dynamic {
        saveListeners.add(input);
        return (): Dynamic => saveListeners.delete(input);
      },
      subscribeStuck(input: Dynamic): Dynamic {
        stuckListeners.add(input);
        return (): Dynamic => stuckListeners.delete(input);
      },
      loadState: (): Dynamic => loadState,
      shown: (): Dynamic => isLoaded(),
      cachedSettled: (): Dynamic => flag12,
      subscribeLoad(input: Dynamic): Dynamic {
        loadListeners.add(input);
        return (): Dynamic => loadListeners.delete(input);
      },
      flushNow: flushPendingNow,
      retryLoad: retryLiveSync,
      storeUntouched: (): Dynamic =>
        loadState === "live" &&
        !flag7 &&
        !flag14 &&
        inFlightWrites.size === 0 &&
        pendingWriteCount() === 0,
      releaseHold: releaseHeldDocument,
      syncDetail: (): Dynamic => ({
        pending: pendingWriteCount(),
        inflight: inFlightWrites.keys().next().value ?? null,
        flights: inFlightWrites.size,
        ...(value14 !== undefined
          ? {
              lastSyncedAt: value14,
            }
          : {}),
        ...(value15 !== undefined
          ? {
              lastError: value15,
            }
          : {}),
      }),
      dispose(): Dynamic {
        flag15 = true;
        unsubscribeCollections();
        clearTimers();
        removeLifecycleListeners();
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "liveDocumentFlushers",
    () => liveDocumentFlushers,
    (value) => {
      liveDocumentFlushers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registerLiveDocumentFlusher",
    () => registerLiveDocumentFlusher,
  );
  bindRuntimeValue(
    runtime,
    "LIVE_WRITE_DEBOUNCE_MS",
    () => LIVE_WRITE_DEBOUNCE_MS,
    (value) => {
      LIVE_WRITE_DEBOUNCE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_WRITE_MAX_WAIT_MS",
    () => LIVE_WRITE_MAX_WAIT_MS,
    (value) => {
      LIVE_WRITE_MAX_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_INITIAL_LOAD_TIMEOUT_MS",
    () => LIVE_INITIAL_LOAD_TIMEOUT_MS,
    (value) => {
      LIVE_INITIAL_LOAD_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_RECONNECT_BACKOFF_MS",
    () => LIVE_RECONNECT_BACKOFF_MS,
    (value) => {
      LIVE_RECONNECT_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_RECENT_RECONNECT_DELAY_MS",
    () => LIVE_RECENT_RECONNECT_DELAY_MS,
    (value) => {
      LIVE_RECENT_RECONNECT_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_RECENT_RECONNECT_WINDOW_MS",
    () => LIVE_RECENT_RECONNECT_WINDOW_MS,
    (value) => {
      LIVE_RECENT_RECONNECT_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_MAX_RECOVERY_RETRIES",
    () => LIVE_MAX_RECOVERY_RETRIES,
    (value) => {
      LIVE_MAX_RECOVERY_RETRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_WRITE_ACK_TIMEOUT_MS",
    () => LIVE_WRITE_ACK_TIMEOUT_MS,
    (value) => {
      LIVE_WRITE_ACK_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_STUCK_WRITE_TIMEOUT_MS",
    () => LIVE_STUCK_WRITE_TIMEOUT_MS,
    (value) => {
      LIVE_STUCK_WRITE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_MAX_PATCH_PROPERTY_COUNT",
    () => LIVE_MAX_PATCH_PROPERTY_COUNT,
    (value) => {
      LIVE_MAX_PATCH_PROPERTY_COUNT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_CONFLICT_RETRY_MS",
    () => LIVE_CONFLICT_RETRY_MS,
    (value) => {
      LIVE_CONFLICT_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_WRITE_RETRY_INITIAL_BACKOFF_MS",
    () => LIVE_WRITE_RETRY_INITIAL_BACKOFF_MS,
    (value) => {
      LIVE_WRITE_RETRY_INITIAL_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_MAX_WRITE_RETRY_BACKOFF_MS",
    () => LIVE_MAX_WRITE_RETRY_BACKOFF_MS,
    (value) => {
      LIVE_MAX_WRITE_RETRY_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_RETRY_INITIAL_BACKOFF_MS",
    () => LIVE_RETRY_INITIAL_BACKOFF_MS,
    (value) => {
      LIVE_RETRY_INITIAL_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_RETRY_MAX_BACKOFF_MS",
    () => LIVE_RETRY_MAX_BACKOFF_MS,
    (value) => {
      LIVE_RETRY_MAX_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_ERROR_SURFACE_DELAY_MS",
    () => LIVE_ERROR_SURFACE_DELAY_MS,
    (value) => {
      LIVE_ERROR_SURFACE_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_FRAME_FALLBACK_DELAY_MS",
    () => LIVE_FRAME_FALLBACK_DELAY_MS,
    (value) => {
      LIVE_FRAME_FALLBACK_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_MAX_ACKNOWLEDGED_WRITES",
    () => LIVE_MAX_ACKNOWLEDGED_WRITES,
    (value) => {
      LIVE_MAX_ACKNOWLEDGED_WRITES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_EXTENDED_LOAD_TIMEOUT_MS",
    () => LIVE_EXTENDED_LOAD_TIMEOUT_MS,
    (value) => {
      LIVE_EXTENDED_LOAD_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_MAX_INFLIGHT_WRITES",
    () => LIVE_MAX_INFLIGHT_WRITES,
    (value) => {
      LIVE_MAX_INFLIGHT_WRITES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_SYNC_EXPLANATION",
    () => LIVE_SYNC_EXPLANATION,
    (value) => {
      LIVE_SYNC_EXPLANATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createLiveDocumentTimers",
    () => createLiveDocumentTimers,
  );
  bindRuntimeValue(runtime, "formatSyncTime", () => formatSyncTime);
  bindRuntimeValue(runtime, "pluralizeSyncCount", () => pluralizeSyncCount);
  bindRuntimeValue(runtime, "createLiveDocument", () => createLiveDocument);
  return () => {
    liveDocumentFlushers = new Set();
    LIVE_WRITE_DEBOUNCE_MS = 350;
    LIVE_WRITE_MAX_WAIT_MS = 1500;
    LIVE_INITIAL_LOAD_TIMEOUT_MS = 1e4;
    LIVE_RECONNECT_BACKOFF_MS = [2e3, 4e3, 8e3, 15e3, 3e4, 6e4];
    LIVE_RECENT_RECONNECT_DELAY_MS = 5e3;
    LIVE_RECENT_RECONNECT_WINDOW_MS = 3e5;
    LIVE_MAX_RECOVERY_RETRIES = 3;
    LIVE_WRITE_ACK_TIMEOUT_MS = 5e3;
    LIVE_STUCK_WRITE_TIMEOUT_MS = 6e4;
    LIVE_MAX_PATCH_PROPERTY_COUNT = 64;
    LIVE_CONFLICT_RETRY_MS = [300, 800];
    LIVE_WRITE_RETRY_INITIAL_BACKOFF_MS = 2e3;
    LIVE_MAX_WRITE_RETRY_BACKOFF_MS = 3e4;
    LIVE_RETRY_INITIAL_BACKOFF_MS = 1e3;
    LIVE_RETRY_MAX_BACKOFF_MS = 8e3;
    LIVE_ERROR_SURFACE_DELAY_MS = 3e4;
    LIVE_FRAME_FALLBACK_DELAY_MS = 16;
    LIVE_MAX_ACKNOWLEDGED_WRITES = 8;
    LIVE_EXTENDED_LOAD_TIMEOUT_MS = 35e3;
    LIVE_MAX_INFLIGHT_WRITES = 4;
    LIVE_SYNC_EXPLANATION =
      "Edits sync as you go; if two people change the same thing, the last change wins.";
  };
}
