/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformFilesPublisher(
  runtime: RuntimeBindings,
): () => void {
  var FILE_PUBLISH_PACING: Dynamic;
  var FILE_REMOTE_UPDATE_WAIT_MS: Dynamic;
  var FILE_FLUSH_TIMEOUT_MS: Dynamic;
  var FILE_PUBLISH_INITIAL_BACKOFF_MS: Dynamic;
  var FILE_PUBLISH_MAX_BACKOFF_MS: Dynamic;
  var FILE_PUBLISH_RETRY_BUDGET_MS: Dynamic;
  var FILE_PUBLISH_RETRY_JITTER_MS: Dynamic;
  var FILE_CONFLICT_MAX_JITTER_MS: Dynamic;
  var FILE_PUBLISH_STUCK_RETRY_MS: Dynamic;
  var MAX_FILE_CONFLICTS_PER_WINDOW: Dynamic;
  var FILE_CONFLICT_HISTORY_WINDOW_MS: Dynamic;
  var FILE_CONFLICT_RETRY_COOLDOWN_MS: Dynamic;
  var FILE_PUBLISH_MAX_RETRIES: Dynamic;
  var FILE_PUBLISH_RECOVERY_LIMIT_MS: Dynamic;
  var MAX_FILE_VERSION_ADOPTION_WAITS: Dynamic;
  var MAX_OWN_PUBLISHED_VERSIONS: Dynamic;
  var FILE_PUBLISH_MIN_RETRY_GAP_MS: Dynamic;
  var FILE_PUBLISH_CONFLICT_RETRY_MS: Dynamic;
  var FILE_PUBLISH_SETTLE_RETRY_MS: Dynamic;
  var PERMANENT_PUBLISH_ERROR_CODES: Dynamic;
  var isIndexPublishFailure: Dynamic;
  function createPublishTimers(): Dynamic {
    return {
      setTimeout: (input?: Dynamic, options?: Dynamic): Dynamic =>
        setTimeout(input, options),
      clearTimeout: (input?: Dynamic): Dynamic => clearTimeout(input),
      now: (): Dynamic => Date.now(),
      random: (): Dynamic => Math.random(),
    };
  }
  function createFilesPublisher(options?: Dynamic): Dynamic {
    let { port: originalPort }: Dynamic = options,
      port: Dynamic = originalPort,
      timers: Dynamic = options.timers ?? createPublishTimers(),
      indexState: Dynamic = options.index,
      indexPath: Dynamic = indexState?.path,
      isIndexPath: Dynamic = (input?: Dynamic): Dynamic =>
        indexPath !== undefined
          ? input === indexPath
          : (0, runtime.isProjectMetadataFile)(input),
      dirtyEdits: Dynamic = new Map(),
      inFlightEdits: Dynamic = new Map(),
      conflictHistory: Dynamic = new Map(),
      entries: Dynamic = new Map(),
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(),
      remoteHashes: Dynamic = new Map(),
      entries2: Dynamic = new Map(),
      unsendableEdits: Dynamic = new Map(),
      unsendableStashed: Dynamic = false,
      ownPublishedHashes: Dynamic = new Map(),
      ownChangedPaths: Dynamic = new Set(),
      remoteVersion: Dynamic,
      callback: Dynamic = (): Dynamic =>
        remoteVersion === originalPort.version().version ||
        originalPort.version().version === lastPublishedVersion,
      lastPublishedVersion: Dynamic,
      ownPublishedVersions: Dynamic = new Set(),
      metrics: Dynamic = {
        publishes: 0,
        pathsSent: 0,
        conflicts: 0,
        retries: 0,
        rateLimited: 0,
        bytesSent: 0,
        lastPublishMs: 0,
        surfaced: 0,
      },
      index: Dynamic = 0,
      inFlight: Dynamic = false,
      flushRequested: Dynamic = false,
      disposed: Dynamic = false,
      lastError: Dynamic,
      backoffUntil: Dynamic,
      backoffMs: Dynamic = FILE_PUBLISH_INITIAL_BACKOFF_MS,
      flushTimer: Dynamic,
      value: Dynamic = -1 / 0,
      idleWaiters: Dynamic = [],
      flag: Dynamic = false,
      flag2: Dynamic = false,
      remoteChangeCount: Dynamic = 0,
      retryWindow: Dynamic,
      retryBudgetMs: Dynamic =
        options.retryBudgetMs ?? FILE_PUBLISH_RETRY_BUDGET_MS,
      conflictWindow: Dynamic,
      stuckState: Dynamic,
      retryTimer: Dynamic,
      stuckRetryMs: Dynamic =
        options.stuckRetryMs ?? FILE_PUBLISH_STUCK_RETRY_MS,
      stashDirty: Dynamic = false,
      stashOffered: Dynamic = false,
      retryNotBefore: Dynamic = 0,
      flag3: Dynamic = false,
      value2: Dynamic,
      value3: Dynamic,
      flag4: Dynamic = false,
      flag5: Dynamic = false,
      value4: Dynamic = -1 / 0,
      interruptWait: Dynamic,
      waitIsInterruptible: Dynamic = false,
      random: Dynamic = (): Dynamic => timers.random?.() ?? Math.random(),
      jitterDelay: Dynamic = (input?: Dynamic): Dynamic =>
        Math.round(input / 2 + random() * (input / 2)),
      getRetryBudget: Dynamic = (): Dynamic =>
        options.retryBudgetMs ?? FILE_PUBLISH_RETRY_BUDGET_MS;
    function interruptibleDelay(
      input?: Dynamic,
      options2: Dynamic = false,
    ): Dynamic {
      return new Promise((input2?: Dynamic): Dynamic => {
        let value12: Dynamic = timers.setTimeout((): Dynamic => {
          interruptWait = undefined;
          input2(false);
        }, input);
        waitIsInterruptible = options2;
        interruptWait = (): Dynamic => {
          timers.clearTimeout(value12);
          interruptWait = undefined;
          input2(true);
        };
      });
    }
    let currentLiveHash: Dynamic = (input?: Dynamic): Dynamic =>
        remoteHashes.has(input)
          ? remoteHashes.get(input)
          : port.liveSha?.(input),
      getSyncState: Dynamic = (): Dynamic => ({
        dirty: dirtyEdits.size,
        inFlight: inFlight,
        ...(lastError !== undefined
          ? {
              lastError: lastError,
            }
          : {}),
        ...(backoffUntil !== undefined
          ? {
              backoffUntil: backoffUntil,
            }
          : {}),
        ...(stuckState !== undefined
          ? {
              stuck: {
                ...stuckState,
                paths: [...stuckState.paths],
              },
            }
          : {}),
        ...(unsendableEdits.size > 0
          ? {
              unsendable: [...unsendableEdits].map(
                ([input, input2]: Dynamic): Dynamic => ({
                  path: input,
                  why: input2.why,
                  cause: input2.cause,
                }),
              ),
              ...(unsendableStashed
                ? {
                    unsendableStashed: true,
                  }
                : {}),
            }
          : {}),
      }),
      notifyState: Dynamic = (): Dynamic => {
        try {
          options.onState?.(getSyncState());
        } catch {}
        if (
          !inFlight &&
          flushTimer === undefined &&
          (dirtyEdits.size === 0 || isStoppedByError())
        ) {
          let value12: Dynamic = idleWaiters;
          idleWaiters = [];
          for (let value13 of value12 as Dynamic) value13();
        }
      },
      isStoppedByError: Dynamic = (): Dynamic =>
        lastError !== undefined &&
        backoffUntil === undefined &&
        !flushRequested,
      isOwnPublishedHash: Dynamic = (input?: Dynamic): Dynamic =>
        ownPublishedHashes.has(input.path) &&
        ownPublishedHashes.get(input.path) === input.sha256,
      value5: Dynamic = -1 / 0,
      peers: Dynamic = options.peers ?? runtime.roomPeersStore,
      hasOtherTabs: Dynamic = (): Dynamic =>
        peers.getSnapshot().some((input?: Dynamic): Dynamic => !input.sameTab),
      hasRecentRemoteActivity: Dynamic = (): Dynamic =>
        timers.now() - value5 < FILE_PUBLISH_PACING.recentMs,
      isSoloPaced: Dynamic = (): Dynamic =>
        options.paced === true && !hasOtherTabs() && !hasRecentRemoteActivity(),
      getPacing: Dynamic = (): Dynamic =>
        options.paced !== true
          ? undefined
          : isSoloPaced()
            ? FILE_PUBLISH_PACING.solo
            : FILE_PUBLISH_PACING.shared;
    function switchToSharedPacing(): Dynamic {
      if (!disposed) {
        scheduleMaxWait();
        flushTimer !== undefined &&
          (timers.clearTimeout(flushTimer), (flushTimer = undefined));
        schedulePublish();
        try {
          options.onShared?.();
        } catch {}
      }
    }
    function noteRemoteActivity(): Dynamic {
      let value12: Dynamic = isSoloPaced();
      value5 = timers.now();
      value12 && switchToSharedPacing();
    }
    let value6: Dynamic = options.paced === true && hasOtherTabs(),
      value7: Dynamic =
        options.paced !== true
          ? undefined
          : peers.subscribe((): Dynamic => {
              let value12: Dynamic = hasOtherTabs(),
                value13: Dynamic = value12 && !value6;
              value6 = value12;
              value13 && !hasRecentRemoteActivity() && switchToSharedPacing();
            });
    function scheduleMaxWait(): Dynamic {
      value3 !== undefined &&
        (timers.clearTimeout(value3), (value3 = undefined));
      let value12: Dynamic = getPacing();
      value12 === undefined ||
        value2 === undefined ||
        disposed ||
        (value3 = timers.setTimeout(
          (): Dynamic => {
            value3 = undefined;
            if (dirtyEdits.size === 0) {
              value2 = undefined;
              return;
            }
            stuckState === undefined &&
              ((flushRequested = true), schedulePublish());
          },
          Math.max(0, value2 + value12.maxWaitMs - timers.now()),
        ));
    }
    let value8: Dynamic = originalPort.onRemoteChange(
      (input?: Dynamic): Dynamic => handleRemoteChange(input),
    );
    function handleRemoteChange(input?: Dynamic): Dynamic {
      remoteChangeCount += 1;
      let callback2: Dynamic = (input2?: Dynamic): Dynamic =>
          isOwnPublishedHash(input2) ||
          (ownChangedPaths.has(input2.path) &&
            input2.sha256 !== null &&
            ownPublishedVersions.has(input.to.version)),
        value12: Dynamic = input.changed.some(
          (input2?: Dynamic): Dynamic => !callback2(input2),
        );
      for (let value15 of input.changed as Dynamic) {
        remoteHashes.set(value15.path, value15.sha256);
        ownChangedPaths.delete(value15.path);
        ownPublishedHashes.has(value15.path) &&
          ownPublishedHashes.get(value15.path) !== value15.sha256 &&
          ownPublishedHashes.delete(value15.path);
      }
      remoteVersion = input.to.version;
      value12 && noteRemoteActivity();
      let value13: Dynamic =
          isIndexPublishFailure(stuckState?.code) &&
          indexPath !== undefined &&
          input.changed.some(
            (input2?: Dynamic): Dynamic => input2.path === indexPath,
          ),
        value14: Dynamic =
          value13 && !flag2
            ? runtime.DAMAGED_INDEX_RETRY_DELAY_MS - (timers.now() - value4)
            : 0;
      if (value14 > 0) {
        retryTimer === undefined &&
          !disposed &&
          (retryTimer = timers.setTimeout((): Dynamic => {
            retryTimer = undefined;
            retryStuck(getRetryBudget());
          }, value14));
        return;
      }
      (flag2 || value13) &&
        !inFlight &&
        !disposed &&
        retryStuck(getRetryBudget());
    }
    indexState?.bind?.(
      (input?: Dynamic, options2?: Dynamic, context?: Dynamic): Dynamic =>
        markDirty(input, options2, context),
    );
    function recordConflict(input?: Dynamic): Dynamic {
      let value12: Dynamic = timers.now();
      conflictHistory.set(input, [
        ...(conflictHistory.get(input) ?? []).filter(
          (input2?: Dynamic): Dynamic =>
            value12 - input2 < FILE_CONFLICT_HISTORY_WINDOW_MS,
        ),
        value12,
      ]);
    }
    function markDirty(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      if (disposed) return;
      let entry: Dynamic = dirtyEdits.get(input);
      index += 1;
      let value12: Dynamic =
          ownPublishedHashes.has(input) &&
          (currentLiveHash(input) === undefined ||
            currentLiveHash(input) === ownPublishedHashes.get(input)),
        value13: Dynamic =
          context !== undefined
            ? context
            : entry !== undefined
              ? entry.base
              : value12
                ? ownPublishedHashes.get(input)
                : (port.heldSha?.(input) ?? currentLiveHash(input) ?? null);
      entries2.delete(input);
      unsendableEdits.delete(input);
      dirtyEdits.set(input, {
        value: options2,
        base: value13,
        gen: index,
      });
      value2 === undefined && ((value2 = timers.now()), scheduleMaxWait());
      values2.delete(input);
      if (context !== undefined) {
        let entry2: Dynamic = entries.get(input);
        entry2 !== undefined &&
          timers.now() - entry2 < FILE_CONFLICT_HISTORY_WINDOW_MS &&
          recordConflict(input);
        entries.delete(input);
        inFlightEdits.delete(input);
      }
      stuckState !== undefined &&
        (stuckState = {
          ...stuckState,
          paths: [...dirtyEdits.keys()],
        });
      flag8 = false;
      scheduleCrashStash();
      notifyState();
    }
    function flushNow(): Dynamic {
      if (!(disposed && dirtyEdits.size === 0) && dirtyEdits.size !== 0) {
        if (stuckState !== undefined) {
          inFlight ? (flushRequested = true) : retryStuck(getRetryBudget());
          return;
        }
        flushRequested = true;
        schedulePublish();
      }
    }
    function retryStuck(input?: Dynamic, options2: Dynamic = false): Dynamic {
      if (disposed || inFlight) return;
      let value12: Dynamic = retryNotBefore - timers.now();
      if (value12 > 0 && (flag3 || !options2)) {
        retryTimer === undefined &&
          (retryTimer = timers.setTimeout((): Dynamic => {
            retryTimer = undefined;
            retryStuck(input);
          }, value12));
        return;
      }
      retryTimer !== undefined &&
        (timers.clearTimeout(retryTimer), (retryTimer = undefined));
      flag4 = true;
      flushTimer !== undefined &&
        (timers.clearTimeout(flushTimer), (flushTimer = undefined));
      retryWindow = undefined;
      retryBudgetMs = input;
      flag2 = false;
      lastError = undefined;
      if (dirtyEdits.size === 0) {
        notifyState();
        return;
      }
      flushRequested = true;
      schedulePublish();
    }
    function schedulePublish(): Dynamic {
      if (inFlight || !flushRequested) return;
      if (flushTimer !== undefined) {
        scheduleCrashStash(0);
        return;
      }
      if (dirtyEdits.size === 0) {
        flushRequested = false;
        notifyState();
        return;
      }
      let value12: Dynamic =
        Math.max(options.minGapMs ?? 0, flag4 ? 0 : (getPacing()?.gapMs ?? 0)) -
        (timers.now() - value);
      if (value12 > 0) {
        flushTimer = timers.setTimeout((): Dynamic => {
          flushTimer = undefined;
          schedulePublish();
        }, value12);
        scheduleCrashStash(0);
        return;
      }
      flushRequested = false;
      flag4 = false;
      publishBatch();
    }
    function rebaseDirtyEdits(): Dynamic {
      values.clear();
      for (let [value12, value13] of [...dirtyEdits] as Dynamic) {
        if (isIndexPath(value12)) continue;
        let value14: Dynamic = currentLiveHash(value12);
        if (value14 === undefined || value14 === value13.base) continue;
        if (
          ownPublishedHashes.has(value12) &&
          ownPublishedHashes.get(value12) === value14
        ) {
          value13.base = value14;
          continue;
        }
        if (
          ownChangedPaths.has(value12) &&
          typeof value14 == "string" &&
          callback()
        ) {
          ownChangedPaths.delete(value12);
          ownPublishedHashes.set(value12, value14);
          value13.base = value14;
          continue;
        }
        let value15: Dynamic = timers.now();
        if (
          (conflictHistory.get(value12) ?? []).filter(
            (input?: Dynamic): Dynamic =>
              value15 - input < FILE_CONFLICT_HISTORY_WINDOW_MS,
          ).length >= MAX_FILE_CONFLICTS_PER_WINDOW
        ) {
          values.add(value12);
          continue;
        }
        let value16: Dynamic,
          flag9: Dynamic = false;
        try {
          value16 = value13.value();
        } catch {
          value16 = null;
          flag9 = true;
        }
        let state: Dynamic = {
          path: value12,
          base: value13.base,
          mine: value16,
          theirsSha: value14,
          ...(flag9
            ? {
                unreadable: true,
              }
            : {}),
        };
        dirtyEdits.delete(value12);
        inFlightEdits.set(value12, state);
        entries.set(value12, value15);
        metrics.surfaced += 1;
        options.stash !== undefined && ((stashDirty = true), (flag8 = false));
        try {
          options.onConflict(state);
        } catch {}
      }
    }
    function beginRetryAttempt(): Dynamic {
      let value12: Dynamic = timers.now();
      retryWindow ??= {
        since: value12,
        refusals: 0,
        budgetMs: retryBudgetMs,
      };
      retryWindow.refusals += 1;
      conflictWindow ??= {
        since: value12,
        attempts: 0,
      };
      conflictWindow.attempts += 1;
      return retryWindow;
    }
    async function publishBatch(): Promise<Dynamic> {
      inFlight = true;
      value = timers.now();
      let value12: Dynamic = remoteChangeCount;
      rebaseDirtyEdits();
      if (indexState && indexPath !== undefined && dirtyEdits.has(indexPath)) {
        let value15: Dynamic = currentLiveHash(indexPath),
          value16: Dynamic =
            (value15 != null &&
              value15 !== indexState.baseSha() &&
              ownPublishedHashes.get(indexPath) !== value15) ||
            flag5
              ? await reloadAndMergeIndex()
              : "merged";
        if (value16 !== "merged" && value16 !== "unread") {
          beginRetryAttempt();
          return surfaceStuckState(value16, false, undefined, indexPath);
        }
        if (value16 === "unread") {
          lastError = "conflict";
          beginRetryAttempt();
          notifyState();
          return backoffAndRetry("conflict", true);
        }
      }
      let state: Dynamic = {},
        entries3: Dynamic = new Map(),
        state2: Dynamic = {};
      for (let [value15, value16] of [...dirtyEdits] as Dynamic) {
        if (values.has(value15)) continue;
        let value17: Dynamic;
        try {
          value17 = value16.value();
        } catch {
          continue;
        }
        let value18: Dynamic;
        try {
          if (port.entryProblemDetail !== undefined)
            value18 = port.entryProblemDetail(value15, value17);
          else if (port.entryProblem !== undefined) {
            let value19: Dynamic = port.entryProblem(value15, value17);
            value18 =
              value19 === undefined
                ? undefined
                : {
                    why: value19,
                    cause: "other",
                  };
          } else value18 = (0, runtime.describeInvalidFile)(value15, value17);
        } catch {
          value18 = (0, runtime.describeInvalidFile)(value15, value17);
        }
        if (value18 === undefined) {
          let value19: Dynamic = (0, runtime.describeOversizedFile)(value17);
          value19 !== undefined &&
            (value18 = {
              why: value19,
              cause: "size",
            });
        }
        if (value18 !== undefined && value17 === null) {
          dirtyEdits.delete(value15);
          entries2.delete(value15);
          unsendableEdits.delete(value15);
          continue;
        }
        if (value18 !== undefined) {
          dirtyEdits.delete(value15);
          entries2.set(value15, value18.why);
          unsendableEdits.set(value15, {
            value: value16.value,
            base: value16.base,
            why: value18.why,
            cause: value18.cause,
          });
          unsendableStashed = false;
          options.stash !== undefined && ((stashDirty = true), (flag8 = false));
          try {
            options.onUnsendable?.(value15, value18.why);
          } catch {}
          continue;
        }
        state[value15] = value17;
        entries3.set(value15, value16.gen);
        state2[value15] = value16.base;
      }
      if (entries3.size === 0) {
        if (dirtyEdits.size === 0) {
          resetRetryState();
          return;
        }
        return [...dirtyEdits.keys()].every(
          (input?: Dynamic): Dynamic => values.has(input),
        )
          ? surfaceStuckState(
              "conflict",
              false,
              FILE_CONFLICT_RETRY_COOLDOWN_MS,
            )
          : (beginRetryAttempt(), surfaceStuckState("invalid_content", false));
      }
      notifyState();
      let value13: Dynamic = (0, runtime.splitPublishBatches)(
          state,
          isIndexPath,
        ),
        value14: Dynamic;
      for (let value15 of value13 as Dynamic) {
        let value16: Dynamic = timers.now(),
          value17: Dynamic,
          value18: Dynamic = Object.fromEntries(
            Object.keys(value15)
              .filter(
                (input?: Dynamic): Dynamic =>
                  !(
                    ownChangedPaths.has(input) &&
                    state2[input] === ownPublishedHashes.get(input)
                  ),
              )
              .map(
                (input?: Dynamic): Dynamic => [input, state2[input] ?? null],
              ),
          ),
          version: Dynamic = originalPort.version().version;
        try {
          value17 = await originalPort.publish(value15, {
            ifMatch: value18,
          });
        } catch {
          value17 = {
            ok: false,
            code: "upstream_error",
          };
        }
        value17.ok &&
          value17.unchanged !== true &&
          value17.version === version &&
          (value17 = {
            ...value17,
            unchanged: true,
          });
        if (!value17.ok) {
          value14 = value17;
          break;
        }
        if (value17.changed)
          for (let value21 of value17.changed as Dynamic)
            value21.path in value15 ||
              (remoteHashes.set(value21.path, value21.sha256),
              ownChangedPaths.delete(value21.path));
        let value19: Dynamic =
          value17.preconditionsChecked === true &&
          Object.keys(value15).every(
            (input?: Dynamic): Dynamic => Object.hasOwn(value18, input),
          );
        value17.unchanged === true ||
          (value19 && value17.changed === undefined) ||
          ((lastPublishedVersion = value17.version),
          ownPublishedVersions.add(value17.version),
          ownPublishedVersions.size > MAX_OWN_PUBLISHED_VERSIONS &&
            ownPublishedVersions.delete(
              ownPublishedVersions.values().next().value,
            ));
        metrics.publishes += 1;
        metrics.pathsSent += Object.keys(value15).length;
        metrics.lastPublishMs = timers.now() - value16;
        let value20: Dynamic =
          value17.shas ?? (await (0, runtime.hashFileMap)(value15));
        for (let [value21, value22] of Object.entries(value15) as Dynamic) {
          let value23: Dynamic =
            value22 === null ? null : (value20[value21] ?? null);
          metrics.bytesSent += (0, runtime.getRawFileBytes)(value22);
          ownPublishedHashes.set(value21, value23);
          remoteHashes.set(value21, value23);
          !(
            value17.shas?.[value21] !== undefined &&
            value17.computed?.includes(value21) !== true
          ) &&
          value23 !== null &&
          (0, runtime.hasInjectedRuntime)(value22)
            ? ownChangedPaths.add(value21)
            : ownChangedPaths.delete(value21);
          value23 !== null &&
            value17.unchanged !== true &&
            options.tokens?.advance?.(value21, value23);
          let entry: Dynamic = dirtyEdits.get(value21);
          entry !== undefined && entry.gen === entries3.get(value21)
            ? (dirtyEdits.delete(value21), entries.delete(value21))
            : entry !== undefined && (entry.base = value23);
          indexState &&
            value21 === indexPath &&
            value23 !== null &&
            indexState.markSaved(
              (0, runtime.extractPortFileText)(value22),
              value23,
            );
        }
      }
      if (value14 === undefined) {
        let value15: Dynamic = [...values].some(
          (input?: Dynamic): Dynamic => dirtyEdits.has(input),
        );
        resetRetryState(!value15, !value15);
        let value16: Dynamic = [...dirtyEdits.keys()].some(
          (input?: Dynamic): Dynamic => !values.has(input),
        );
        value15 &&
          surfaceStuckState(
            "conflict",
            false,
            value16 ? 0 : FILE_CONFLICT_RETRY_COOLDOWN_MS,
            undefined,
            value16 ? getRetryBudget() : 0,
          );
        return;
      }
      await handlePublishFailure(value14, value12);
    }
    function resetRetryState(
      input: Dynamic = true,
      options2: Dynamic = true,
    ): Dynamic {
      flag = false;
      flag2 = false;
      lastError = undefined;
      backoffUntil = undefined;
      backoffMs = FILE_PUBLISH_INITIAL_BACKOFF_MS;
      retryWindow = undefined;
      conflictWindow = undefined;
      retryBudgetMs = getRetryBudget();
      stuckState = undefined;
      stuckRetryMs = options.stuckRetryMs ?? FILE_PUBLISH_STUCK_RETRY_MS;
      retryNotBefore = 0;
      flag3 = false;
      retryTimer !== undefined &&
        (timers.clearTimeout(retryTimer), (retryTimer = undefined));
      clearSettledStash();
      value2 = dirtyEdits.size === 0 ? undefined : timers.now();
      scheduleMaxWait();
      inFlight = false;
      options2 && notifyState();
      input && schedulePublish();
    }
    async function handlePublishFailure(
      input?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      lastError = input.code;
      if (input.code === "conflict") {
        metrics.conflicts += 1;
        if (input.changed)
          for (let value13 of input.changed as Dynamic) {
            remoteHashes.set(value13.path, value13.sha256);
            ownChangedPaths.delete(value13.path);
          }
        if (input.paths)
          for (let value13 of input.paths as Dynamic) {
            remoteHashes.set(value13.path, value13.liveSha);
            ownChangedPaths.delete(value13.path);
          }
        let value12: Dynamic = beginRetryAttempt();
        for (
          indexState &&
            indexPath !== undefined &&
            dirtyEdits.has(indexPath) &&
            (flag5 = true),
            notifyState();
          ;

        ) {
          let value13: Dynamic =
            remoteChangeCount !== options2 ||
            (input.live !== undefined &&
              originalPort.version().version === input.live)
              ? true
              : await waitForRemoteUpdate();
          for (
            let index3: Dynamic = 0;
            value13 &&
            ownChangedPaths.size > 0 &&
            !callback() &&
            index3 < MAX_FILE_VERSION_ADOPTION_WAITS &&
            !disposed;
            index3++
          )
            await waitForRemoteUpdate();
          let value14: Dynamic = await refreshLiveHashes();
          if (disposed) {
            inFlight = false;
            notifyState();
            return;
          }
          if (value13 && !value14 && remoteChangeCount === options2) {
            if (timers.now() - value12.since >= value12.budgetMs)
              return surfaceStuckState("conflict", false);
            let value15: Dynamic = Math.min(
              jitterDelay(FILE_PUBLISH_RETRY_JITTER_MS * 2),
              Math.max(1, value12.budgetMs - (timers.now() - value12.since)),
            );
            backoffUntil = timers.now() + value15;
            notifyState();
            await interruptibleDelay(value15);
            backoffUntil = undefined;
            continue;
          }
          rebaseDirtyEdits();
          if (
            indexState &&
            indexPath !== undefined &&
            dirtyEdits.has(indexPath)
          ) {
            let value15: Dynamic = await reloadAndMergeIndex();
            if (value15 !== "merged" && value15 !== "unread")
              return surfaceStuckState(value15, false, undefined, indexPath);
          }
          if (dirtyEdits.size === 0) {
            resetRetryState();
            return;
          }
          if (!value13) {
            if (flag) return surfaceStuckState("conflict", true);
            flag = true;
          }
          return backoffAndRetry("conflict", value13);
        }
      }
      if (input.code === "rate_limited") {
        metrics.rateLimited += 1;
        let value12: Dynamic = beginRetryAttempt(),
          value13: Dynamic =
            input.retryAfterMs !== undefined &&
            Number.isFinite(input.retryAfterMs) &&
            input.retryAfterMs >= 0
              ? Math.min(
                  Math.max(input.retryAfterMs, FILE_PUBLISH_MIN_RETRY_GAP_MS),
                  FILE_PUBLISH_RECOVERY_LIMIT_MS,
                )
              : undefined,
          value14: Dynamic = value13 ?? backoffMs;
        backoffMs = Math.min(FILE_PUBLISH_MAX_BACKOFF_MS, backoffMs * 2);
        retryNotBefore = timers.now() + value14;
        flag3 = value13 !== undefined;
        backoffUntil = retryNotBefore;
        notifyState();
        let value15: Dynamic =
            value12.budgetMs - (timers.now() - value12.since),
          value16: Dynamic = await interruptibleDelay(
            Math.max(0, Math.min(value14, value15)),
            flag3,
          );
        if (disposed) {
          inFlight = false;
          notifyState();
          return;
        }
        return !value16 &&
          (timers.now() < retryNotBefore ||
            timers.now() - value12.since >= value12.budgetMs)
          ? surfaceStuckState(
              "rate_limited",
              false,
              Math.max(
                retryNotBefore - timers.now(),
                FILE_PUBLISH_MIN_RETRY_GAP_MS,
              ),
            )
          : ((retryNotBefore = 0),
            (backoffUntil = undefined),
            (metrics.retries += 1),
            (lastError = undefined),
            publishBatch());
      }
      if (input.code === "upstream_error") {
        beginRetryAttempt();
        notifyState();
        return backoffAndRetry("upstream_error", true);
      }
      beginRetryAttempt();
      surfaceStuckState(input.code, false);
    }
    async function backoffAndRetry(
      input?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      let value12: Dynamic = retryWindow,
        value13: Dynamic = timers.now() - value12.since;
      if (value13 >= value12.budgetMs)
        return surfaceStuckState(input, !options2);
      let refusals: Dynamic = value12.refusals,
        value14: Dynamic;
      refusals <= 1
        ? (value14 =
            input === "upstream_error"
              ? FILE_PUBLISH_CONFLICT_RETRY_MS[0] +
                Math.floor(
                  random() *
                    (FILE_PUBLISH_CONFLICT_RETRY_MS[1] -
                      FILE_PUBLISH_CONFLICT_RETRY_MS[0]),
                )
              : 0)
        : (value14 = jitterDelay(
            Math.min(
              FILE_CONFLICT_MAX_JITTER_MS,
              FILE_PUBLISH_RETRY_JITTER_MS * 2 ** (refusals - 2),
            ),
          ));
      value14 = Math.min(value14, value12.budgetMs - value13);
      metrics.retries += 1;
      value14 > 0 &&
        ((backoffUntil = timers.now() + value14),
        notifyState(),
        await interruptibleDelay(value14),
        (backoffUntil = undefined));
      if (disposed) {
        inFlight = false;
        notifyState();
        return;
      }
      lastError = undefined;
      return publishBatch();
    }
    function surfaceStuckState(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value12?: Dynamic,
      extra: Dynamic = 0,
    ): Dynamic {
      let value13: Dynamic = timers.now();
      lastError = input;
      let value14: Dynamic =
        input === "conflict" &&
        (conflictWindow?.attempts ?? 0) >= FILE_PUBLISH_MAX_RETRIES;
      flag2 = options2 || value14;
      backoffUntil = undefined;
      flushRequested = false;
      inFlight = false;
      retryWindow = undefined;
      let value15: Dynamic = !PERMANENT_PUBLISH_ERROR_CODES.has(input),
        value16: Dynamic,
        value17: Dynamic = options.stuckRetryMs ?? FILE_PUBLISH_STUCK_RETRY_MS;
      if (
        value15 &&
        !options2 &&
        !value14 &&
        (value17 > 0 || context !== undefined)
      ) {
        let value18: Dynamic = context ?? jitterDelay(stuckRetryMs);
        context === undefined &&
          (stuckRetryMs = Math.min(
            FILE_PUBLISH_MAX_BACKOFF_MS,
            stuckRetryMs * 2,
          ));
        value16 = value13 + value18;
        retryTimer !== undefined && timers.clearTimeout(retryTimer);
        retryTimer = timers.setTimeout((): Dynamic => {
          retryTimer = undefined;
          retryStuck(extra);
        }, value18);
      }
      stuckState = {
        code: input,
        since: conflictWindow?.since ?? value13,
        attempts: conflictWindow?.attempts ?? 1,
        paths: [...dirtyEdits.keys()],
        retryable: value15,
        stashed: stuckState?.stashed ?? false,
        ...(value16 !== undefined
          ? {
              nextRetryAt: value16,
            }
          : {}),
        ...(value12 !== undefined
          ? {
              file: value12,
            }
          : {}),
      };
      flag8 = false;
      writeCrashStash();
      notifyState();
    }
    let index2: Dynamic = 0,
      value9: Dynamic = Promise.resolve();
    function serializeStashWork(input?: Dynamic): Dynamic {
      let value12: Dynamic = value9.then(input);
      value9 = value12.catch((): Dynamic => {});
      return value12;
    }
    let flag6: Dynamic = false,
      flag7: Dynamic = false;
    function writeCrashStash(): Dynamic {
      if (options.stash === undefined || flag8) return;
      if (flag6) {
        flag7 = true;
        return;
      }
      let items: Dynamic = [],
        flag9: Dynamic = true,
        value12: Dynamic = [...dirtyEdits].map(
          ([input, input2]: Dynamic): Dynamic => [
            input,
            input2.value,
            input2.base,
          ],
        );
      for (let [value14, value15] of inFlightEdits as Dynamic)
        if (!dirtyEdits.has(value14)) {
          if (value15.unreadable === true) {
            flag9 = false;
            continue;
          }
          value12.push([value14, (): Dynamic => value15.mine, value15.base]);
        }
      for (let [value14, value15] of unsendableEdits as Dynamic)
        !dirtyEdits.has(value14) &&
          !inFlightEdits.has(value14) &&
          value12.push([value14, value15.value, value15.base]);
      if (value12.length === 0) return;
      for (let [value14, value15, value16] of value12 as Dynamic) {
        let value17: Dynamic;
        try {
          value17 = value15();
        } catch {
          flag9 = false;
          continue;
        }
        let value18: Dynamic =
          value17 === null
            ? null
            : typeof value17 == "object" &&
                !(typeof Blob !== "undefined" && value17 instanceof Blob)
              ? value17.content
              : value17;
        if (value18 !== null && typeof value18 != "string") {
          flag9 = false;
          continue;
        }
        items.push({
          path: value14,
          text: value18,
          base: value16,
        });
      }
      stashDirty = true;
      flag6 = true;
      let value13: Dynamic = ++index2,
        stash: Dynamic = options.stash,
        version: Dynamic = originalPort.version().version;
      serializeStashWork((): Dynamic => stash.put(items, version))
        .finally((): Dynamic => {
          flag6 = false;
          flag7 && ((flag7 = false), writeCrashStash());
        })
        .then((input?: Dynamic): Dynamic => {
          value13 !== index2 ||
            disposed ||
            (stuckState === undefined && unsendableEdits.size === 0) ||
            (stuckState !== undefined &&
              (stuckState = {
                ...stuckState,
                stashed: input && flag9,
              }),
            (unsendableStashed = unsendableEdits.size > 0 && input && flag9),
            notifyState());
        });
    }
    function clearSettledStash(): Dynamic {
      if (!stashDirty) return;
      if (
        dirtyEdits.size > 0 ||
        inFlightEdits.size > 0 ||
        unsendableEdits.size > 0
      ) {
        scheduleCrashStash(0);
        return;
      }
      stashDirty = false;
      let stash: Dynamic = options.stash,
        value12: Dynamic = stashOffered;
      stashOffered = false;
      stash !== undefined &&
        serializeStashWork(async (): Promise<Dynamic> => {
          await stash.clear();
          value12 && (await stash.clearOffered());
        });
    }
    let flag8: Dynamic = false,
      value10: Dynamic,
      value11: Dynamic;
    function scheduleCrashStash(input: Dynamic = 1e3): Dynamic {
      if (!(options.stash === undefined || disposed)) {
        if (value11 !== undefined) {
          if (input > 0) return;
          timers.clearTimeout(value11);
        }
        value11 = timers.setTimeout((): Dynamic => {
          value11 = undefined;
          !disposed &&
            (dirtyEdits.size > 0 ||
              inFlightEdits.size > 0 ||
              unsendableEdits.size > 0) &&
            writeCrashStash();
        }, input);
      }
    }
    function clearStuckIfClean(): Dynamic {
      dirtyEdits.size > 0 ||
        stuckState === undefined ||
        inFlight ||
        resetRetryState();
    }
    function waitForRemoteUpdate(): Dynamic {
      return new Promise((input?: Dynamic): Dynamic => {
        let flag9: Dynamic = false,
          callback2: Dynamic = (input2?: Dynamic): Dynamic => {
            flag9 ||
              ((flag9 = true),
              value12(),
              timers.clearTimeout(value13),
              input(input2));
          },
          value12: Dynamic = originalPort.onRemoteChange(
            (): Dynamic => callback2(true),
          ),
          value13: Dynamic = timers.setTimeout(
            (): Dynamic => callback2(false),
            FILE_REMOTE_UPDATE_WAIT_MS,
          );
      });
    }
    async function refreshLiveHashes(): Promise<Dynamic> {
      try {
        let value12: Dynamic = await (0, runtime.retryAccessFailure)(
          (): Dynamic => (0, runtime.listWritableFiles)(originalPort),
          timers,
          undefined,
          FILE_PUBLISH_SETTLE_RETRY_MS,
        );
        if ((0, runtime.isNarrowedFileContext)(value12, originalPort))
          return false;
        let entries3: Dynamic = new Map(
          value12.map((input?: Dynamic): Dynamic => [input.path, input.sha256]),
        );
        for (let value13 of dirtyEdits.keys() as Dynamic)
          remoteHashes.set(value13, entries3.get(value13) ?? null);
        indexPath !== undefined &&
          remoteHashes.set(indexPath, entries3.get(indexPath) ?? null);
        return true;
      } catch {
        return false;
      }
    }
    async function reloadAndMergeIndex(): Promise<Dynamic> {
      if (!indexState) return "merged";
      try {
        let value12: Dynamic = await (0, runtime.retryAccessFailure)(
          (): Dynamic => indexState.reloadAndMerge(),
          timers,
          undefined,
          FILE_PUBLISH_SETTLE_RETRY_MS,
        );
        flag5 = false;
        if (value12.length > 0)
          try {
            options.onIndexMerged?.(value12);
          } catch {}
        let entry: Dynamic = dirtyEdits.get(indexState.path);
        entry !== undefined && (entry.base = indexState.baseSha());
        return "merged";
      } catch (value12: Dynamic) {
        if (
          value12 instanceof runtime.IndexFileError &&
          value12.code !== "not_found"
        ) {
          value4 = timers.now();
          return value12.code === "newer_version"
            ? "index_newer_build"
            : "index_damaged";
        }
        if (
          value12?.status === 404 &&
          currentLiveHash(indexState.path) === null
        ) {
          flag5 = false;
          let entry: Dynamic = dirtyEdits.get(indexState.path);
          entry !== undefined && (entry.base = null);
          return "merged";
        }
        return "unread";
      }
    }
    function requestImmediatePublish(): Dynamic {
      if (dirtyEdits.size !== 0) {
        if (stuckState !== undefined) {
          retryStuck(getRetryBudget());
          return;
        }
        flag4 = true;
        flushRequested = true;
        flushTimer !== undefined &&
          (timers.clearTimeout(flushTimer), (flushTimer = undefined));
        schedulePublish();
      }
    }
    function waitUntilIdle(): Dynamic {
      dirtyEdits.size > 0 &&
        !inFlight &&
        !isStoppedByError() &&
        requestImmediatePublish();
      return !inFlight &&
        flushTimer === undefined &&
        (dirtyEdits.size === 0 || isStoppedByError())
        ? Promise.resolve()
        : new Promise((input?: Dynamic): Dynamic => idleWaiters.push(input));
    }
    return {
      markDirty: markDirty,
      commit: flushNow,
      settle: waitUntilIdle,
      async dispose(): Promise<Dynamic> {
        requestImmediatePublish();
        await waitUntilIdle();
        disposed = true;
        value8();
        value7?.();
        value3 !== undefined &&
          (timers.clearTimeout(value3), (value3 = undefined));
        flushTimer !== undefined &&
          (timers.clearTimeout(flushTimer), (flushTimer = undefined));
        retryTimer !== undefined &&
          (timers.clearTimeout(retryTimer), (retryTimer = undefined));
        value10 !== undefined &&
          (timers.clearTimeout(value10), (value10 = undefined));
        value11 !== undefined &&
          (timers.clearTimeout(value11),
          (value11 = undefined),
          writeCrashStash());
        interruptWait?.();
      },
      counters: metrics,
      state: getSyncState,
      conflicted: (): Dynamic => inFlightEdits,
      unsendable: (): Dynamic => entries2,
      resolveConflict(input: Dynamic, options2: Dynamic): Dynamic {
        let entry: Dynamic = inFlightEdits.get(input);
        entry !== undefined &&
          ((options2 === "mine" && entry.unreadable === true) ||
            (inFlightEdits.delete(input),
            options2 === "mine"
              ? markDirty(input, (): Dynamic => entry.mine, entry.theirsSha)
              : clearSettledStash()));
      },
      pending: (): Dynamic =>
        dirtyEdits.size > 0 ||
        inFlight ||
        inFlightEdits.size > 0 ||
        entries2.size > 0,
      isOwnEcho: isOwnPublishedHash,
      solo: isSoloPaced,
      withdraw(input: Dynamic): Dynamic {
        let value12: Dynamic = dirtyEdits.delete(input),
          value13: Dynamic = inFlightEdits.delete(input),
          value14: Dynamic = entries2.delete(input);
        unsendableEdits.delete(input);
        (value12 || value13) && values2.add(input);
        dirtyEdits.size === 0 && ((value2 = undefined), scheduleMaxWait());
        (value12 || value13 || value14) && notifyState();
        clearStuckIfClean();
        clearSettledStash();
      },
      withdrawn: (): Dynamic => values2,
      retryNow(): Dynamic {
        if (!(disposed || dirtyEdits.size === 0)) {
          conflictHistory.clear();
          if (interruptWait !== undefined) {
            waitIsInterruptible || interruptWait();
            return;
          }
          inFlight || retryStuck(getRetryBudget(), true);
        }
      },
      flushNow: requestImmediatePublish,
      stashRestored(): Dynamic {
        options.stash !== undefined &&
          ((stashDirty = true), (stashOffered = true));
      },
      stashHandedOff(): Dynamic {
        if (
          options.stash === undefined ||
          ((flag8 = true),
          value11 !== undefined &&
            (timers.clearTimeout(value11), (value11 = undefined)),
          value10 !== undefined && timers.clearTimeout(value10),
          (value10 = timers.setTimeout((): Dynamic => {
            value10 = undefined;
            !(!flag8 || disposed) &&
              ((flag8 = false),
              (dirtyEdits.size > 0 ||
                inFlightEdits.size > 0 ||
                unsendableEdits.size > 0) &&
                writeCrashStash());
          }, FILE_FLUSH_TIMEOUT_MS)),
          !stashDirty)
        )
          return;
        stashDirty = false;
        let stash: Dynamic = options.stash,
          value12: Dynamic = stashOffered;
        stashOffered = false;
        serializeStashWork(async (): Promise<Dynamic> => {
          await stash.clear();
          value12 && (await stash.clearOffered());
        });
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_PACING",
    () => FILE_PUBLISH_PACING,
    (value) => {
      FILE_PUBLISH_PACING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_REMOTE_UPDATE_WAIT_MS",
    () => FILE_REMOTE_UPDATE_WAIT_MS,
    (value) => {
      FILE_REMOTE_UPDATE_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_FLUSH_TIMEOUT_MS",
    () => FILE_FLUSH_TIMEOUT_MS,
    (value) => {
      FILE_FLUSH_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_INITIAL_BACKOFF_MS",
    () => FILE_PUBLISH_INITIAL_BACKOFF_MS,
    (value) => {
      FILE_PUBLISH_INITIAL_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_MAX_BACKOFF_MS",
    () => FILE_PUBLISH_MAX_BACKOFF_MS,
    (value) => {
      FILE_PUBLISH_MAX_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_RETRY_BUDGET_MS",
    () => FILE_PUBLISH_RETRY_BUDGET_MS,
    (value) => {
      FILE_PUBLISH_RETRY_BUDGET_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_RETRY_JITTER_MS",
    () => FILE_PUBLISH_RETRY_JITTER_MS,
    (value) => {
      FILE_PUBLISH_RETRY_JITTER_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_CONFLICT_MAX_JITTER_MS",
    () => FILE_CONFLICT_MAX_JITTER_MS,
    (value) => {
      FILE_CONFLICT_MAX_JITTER_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_STUCK_RETRY_MS",
    () => FILE_PUBLISH_STUCK_RETRY_MS,
    (value) => {
      FILE_PUBLISH_STUCK_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FILE_CONFLICTS_PER_WINDOW",
    () => MAX_FILE_CONFLICTS_PER_WINDOW,
    (value) => {
      MAX_FILE_CONFLICTS_PER_WINDOW = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_CONFLICT_HISTORY_WINDOW_MS",
    () => FILE_CONFLICT_HISTORY_WINDOW_MS,
    (value) => {
      FILE_CONFLICT_HISTORY_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_CONFLICT_RETRY_COOLDOWN_MS",
    () => FILE_CONFLICT_RETRY_COOLDOWN_MS,
    (value) => {
      FILE_CONFLICT_RETRY_COOLDOWN_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_MAX_RETRIES",
    () => FILE_PUBLISH_MAX_RETRIES,
    (value) => {
      FILE_PUBLISH_MAX_RETRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_RECOVERY_LIMIT_MS",
    () => FILE_PUBLISH_RECOVERY_LIMIT_MS,
    (value) => {
      FILE_PUBLISH_RECOVERY_LIMIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FILE_VERSION_ADOPTION_WAITS",
    () => MAX_FILE_VERSION_ADOPTION_WAITS,
    (value) => {
      MAX_FILE_VERSION_ADOPTION_WAITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_OWN_PUBLISHED_VERSIONS",
    () => MAX_OWN_PUBLISHED_VERSIONS,
    (value) => {
      MAX_OWN_PUBLISHED_VERSIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_MIN_RETRY_GAP_MS",
    () => FILE_PUBLISH_MIN_RETRY_GAP_MS,
    (value) => {
      FILE_PUBLISH_MIN_RETRY_GAP_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_CONFLICT_RETRY_MS",
    () => FILE_PUBLISH_CONFLICT_RETRY_MS,
    (value) => {
      FILE_PUBLISH_CONFLICT_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_SETTLE_RETRY_MS",
    () => FILE_PUBLISH_SETTLE_RETRY_MS,
    (value) => {
      FILE_PUBLISH_SETTLE_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PERMANENT_PUBLISH_ERROR_CODES",
    () => PERMANENT_PUBLISH_ERROR_CODES,
    (value) => {
      PERMANENT_PUBLISH_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isIndexPublishFailure",
    () => isIndexPublishFailure,
    (value) => {
      isIndexPublishFailure = value;
    },
  );
  bindRuntimeValue(runtime, "createPublishTimers", () => createPublishTimers);
  bindRuntimeValue(runtime, "createFilesPublisher", () => createFilesPublisher);
  return () => {
    FILE_PUBLISH_PACING = {
      solo: {
        gapMs: 1e4,
        maxWaitMs: 1e4,
      },
      shared: {
        gapMs: 0,
        maxWaitMs: 1500,
      },
      recentMs: 5 * 6e4,
    };
    FILE_REMOTE_UPDATE_WAIT_MS = 5e3;
    FILE_FLUSH_TIMEOUT_MS = 15e3;
    FILE_PUBLISH_INITIAL_BACKOFF_MS = 2e3;
    FILE_PUBLISH_MAX_BACKOFF_MS = 3e4;
    FILE_PUBLISH_RETRY_BUDGET_MS = 1e4;
    FILE_PUBLISH_RETRY_JITTER_MS = 200;
    FILE_CONFLICT_MAX_JITTER_MS = 3e3;
    FILE_PUBLISH_STUCK_RETRY_MS = 2e3;
    MAX_FILE_CONFLICTS_PER_WINDOW = 3;
    FILE_CONFLICT_HISTORY_WINDOW_MS = 6e4;
    FILE_CONFLICT_RETRY_COOLDOWN_MS = 2e4;
    FILE_PUBLISH_MAX_RETRIES = 20;
    FILE_PUBLISH_RECOVERY_LIMIT_MS = 5 * 6e4;
    MAX_FILE_VERSION_ADOPTION_WAITS = 4;
    MAX_OWN_PUBLISHED_VERSIONS = 64;
    FILE_PUBLISH_MIN_RETRY_GAP_MS = 1e3;
    FILE_PUBLISH_CONFLICT_RETRY_MS = [300, 800];
    FILE_PUBLISH_SETTLE_RETRY_MS = [150, 300, 600, 1e3, 2e3];
    PERMANENT_PUBLISH_ERROR_CODES = new Set([
      "not_writer",
      "not_declared",
      "capability_disabled",
      "too_large",
      "invalid_content",
      "read_only_path",
      "index_newer_build",
      "index_damaged",
    ]);
    isIndexPublishFailure = (input?: Dynamic): Dynamic =>
      input === "index_newer_build" || input === "index_damaged";
  };
}
