/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformFilesHotReload(
  runtime: RuntimeBindings,
): () => void {
  var PlatformFilesHotReloadItems: Dynamic;
  var PlatformFilesHotReloadLimit: Dynamic;
  var PlatformFilesHotReloadName: Dynamic;
  var PlatformFilesHotReloadLimit_2: Dynamic;
  var PlatformFilesHotReloadLimit_3: Dynamic;
  var PlatformFilesHotReloadLimit_4: Dynamic;
  var PlatformFilesHotReloadKind: Dynamic;
  var PlatformFilesHotReloadSlice: Dynamic;
  var PlatformFilesHotReloadVer: Dynamic;
  var PlatformFilesHotReloadPath: Dynamic;
  var PlatformFilesHotReloadAdopt: Dynamic;
  var PlatformFilesHotReloadConstant: Dynamic;
  function getHotCapability(): Dynamic {
    let value: Dynamic = (0, runtime.getCachedHostCapability)("hot");
    return (typeof value == "object" || typeof value == "function") &&
      value !== null
      ? value
      : null;
  }
  function hasHotRestartToken(
    input: Dynamic = PlatformFilesHotReloadName(),
  ): Dynamic {
    try {
      let value: Dynamic = JSON.parse(input)?.hot?.k;
      return typeof value == "string" && value !== "";
    } catch {
      return false;
    }
  }
  function canHotRestart(
    input: Dynamic = getHotCapability(),
    options?: Dynamic,
  ): Dynamic {
    return typeof input?.restart == "function" && hasHotRestartToken(options);
  }
  function awaitHotRestartReady(
    input?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = options.timers ?? {
        setTimeout: (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          setTimeout(input2, options2),
        clearTimeout: (input2?: Dynamic): Dynamic => clearTimeout(input2),
      },
      callback: Dynamic = (): Dynamic => value.now?.() ?? Date.now(),
      value2: Dynamic = callback();
    return new Promise((input2?: Dynamic): Dynamic => {
      let flag: Dynamic = false,
        callback2: Dynamic = (input3?: Dynamic): Dynamic => {
          if (!flag) {
            flag = true;
            input3 || value.clearTimeout?.(value3);
            try {
              options.onEvent?.({
                type: "reveal",
                heldMs: callback() - value2,
                timedOut: input3,
                carried: options.carried === true,
              });
            } catch {}
            input2();
          }
        },
        value3: Dynamic = value.setTimeout(
          (): Dynamic => callback2(true),
          options.holdMs ?? PlatformFilesHotReloadConstant,
        );
      Promise.resolve(input).then(
        (): Dynamic => callback2(false),
        (): Dynamic => callback2(false),
      );
    });
  }
  function createFilesHotReloadController(input?: Dynamic): Dynamic {
    let value: Dynamic =
        input.hot !== undefined ? input.hot : getHotCapability(),
      state: Dynamic = {
        updates: 0,
        applied: 0,
        deferred: 0,
        restarts: 0,
        fetchRetries: 0,
      },
      items: Dynamic = [];
    if (
      input.embedded === true ||
      value === null ||
      typeof value.accept != "function"
    )
      return {
        dispose: (): Dynamic => {},
        active: false,
        stats: (): Dynamic => ({
          ...state,
        }),
        events: items,
      };
    let { port: value2 }: Dynamic = input,
      value3: Dynamic = value2,
      value4: Dynamic = input.isCode ?? runtime.isApplicationCodeFile,
      value5: Dynamic = input.retryMs ?? PlatformFilesHotReloadItems,
      value6: Dynamic = input.timers ?? {
        setTimeout: (input2?: Dynamic, options?: Dynamic): Dynamic =>
          setTimeout(input2, options),
        clearTimeout: (input2?: Dynamic): Dynamic => clearTimeout(input2),
        now: (): Dynamic => Date.now(),
      },
      callback: Dynamic = (): Dynamic => value6.now?.() ?? Date.now(),
      flag: Dynamic = false,
      value7: Dynamic,
      value8: Dynamic,
      items2: Dynamic = [],
      value9: Dynamic;
    value3.knownListing === undefined &&
      value2.list().then(
        (input2?: Dynamic): Dynamic => {
          value9 ??= new Map(
            input2.map(
              (input3?: Dynamic): Dynamic => [input3.path, input3.sha256],
            ),
          );
        },
        (): Dynamic => {},
      );
    function value10(input2?: Dynamic): Dynamic {
      items.push(input2);
      items.length > PlatformFilesHotReloadLimit_4 && items.shift();
      try {
        input.onEvent
          ? input.onEvent(input2)
          : (globalThis as Dynamic).console?.debug?.(
              "[hot]",
              JSON.stringify(input2),
            );
      } catch {}
    }
    let callback2: Dynamic = (input2?: Dynamic): Dynamic => {
      try {
        input.onBeforeRestart?.(input2);
      } catch {}
    };
    function value11(input2?: Dynamic, options: Dynamic = 0): Dynamic {
      value8 ??= input2;
      if (value7 !== undefined || flag) return;
      let callback3: Dynamic = (): Dynamic => {
        value7 = undefined;
        if (flag || value8 === undefined) return;
        if (input.isBusy?.() === true) {
          value7 = value6.setTimeout(callback3, input.busyPollMs ?? 250);
          return;
        }
        let value16: Dynamic = callback();
        for (
          ;
          items2.length > 0 &&
          value16 - items2[0] > PlatformFilesHotReloadLimit_2;

        )
          items2.shift();
        if (items2.length >= PlatformFilesHotReloadLimit_3) {
          value7 = value6.setTimeout(
            callback3,
            PlatformFilesHotReloadLimit_2 - (value16 - items2[0]) + 1,
          );
          return;
        }
        items2.push(value16);
        let value17: Dynamic = value8;
        value8 = undefined;
        state.restarts += 1;
        callback2(value17);
        try {
          value.restart?.({
            note: value17,
          });
        } catch {}
      };
      value7 = value6.setTimeout(callback3, options);
    }
    async function value12(): Promise<Dynamic> {
      let entries: Dynamic = new Map(value3.knownListing?.() ?? value9 ?? []),
        entries2: Dynamic = new Map(
          (await (0, runtime.listWritableFiles)(value2)).map(
            (input2?: Dynamic): Dynamic => [input2.path, input2.sha256],
          ),
        );
      value9 = entries2;
      let items3: Dynamic = [];
      for (let [value16, value17] of entries2 as Dynamic)
        entries.get(value16) !== value17 &&
          items3.push({
            path: value16,
            sha256: value17,
          });
      for (let value16 of entries.keys() as Dynamic)
        entries2.has(value16) ||
          items3.push({
            path: value16,
            sha256: null,
          });
      return items3.sort(
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          input2.path < options.path ? -1 : 1,
      );
    }
    function value13(input2?: Dynamic): Dynamic {
      if (flag) return void input2.restart?.();
      state.updates += 1;
      let value16: Dynamic = PlatformFilesHotReloadVer(input2.from),
        value17: Dynamic = PlatformFilesHotReloadVer(input2.to),
        value18: Dynamic = input.isBusy?.() === true,
        value19: Dynamic =
          input2.required !== "none"
            ? "required"
            : input2.changed !== null &&
                input2.changed.some(
                  (input3?: Dynamic): Dynamic => value4(input3.path),
                )
              ? "code"
              : undefined,
        state2: Dynamic = {
          type: "update",
          from: value16.version,
          to: value17.version,
          ...(value16.seq !== undefined
            ? {
                fromSeq: value16.seq,
              }
            : {}),
          ...(value17.seq !== undefined
            ? {
                toSeq: value17.seq,
              }
            : {}),
          required: String(input2.required),
          shape: PlatformFilesHotReloadAdopt(input2),
          changed: PlatformFilesHotReloadPath(input2.changed, value4),
          busy: value18,
        };
      if (value19 !== undefined) {
        let value21: Dynamic =
            value19 === "code"
              ? "a changed path is the page\u2019s own code: " +
                (input2.changed ?? [])
                  .filter((input3?: Dynamic): Dynamic => value4(input3.path))
                  .map((input3?: Dynamic): Dynamic => input3.path)
                  .join(", ")
              : "required is " + String(input2.required),
          value22: Dynamic =
            value19 === "code" && input2.changed !== null
              ? input2.changed.filter(
                  (input3?: Dynamic): Dynamic => !value4(input3.path),
                )
              : [];
        if (
          value18 &&
          input.contentWhileBusy !== false &&
          value22.length > 0 &&
          typeof input2.adopt == "function"
        ) {
          try {
            input2.adopt();
          } catch (value24: Dynamic) {
            value10({
              ...state2,
              decision: "restart",
              why: "u.adopt() threw: " + PlatformFilesHotReloadSlice(value24),
            });
            callback2("adopt failed");
            return void input2.restart?.();
          }
          value10({
            ...state2,
            decision: "adopt",
            why:
              value21 +
              "; the person is busy, so the " +
              String(value22.length) +
              " content row(s) are applied in place now and the restart waits",
          });
          value10({
            type: "deferred",
            from: value16.version,
            to: value17.version,
            reason: "code",
          });
          state.deferred += 1;
          let value23: Dynamic = callback();
          try {
            value3.noteAdopted?.(value17, value16);
          } catch {}
          value11("deferred-update", input.busyPollMs ?? 250);
          return value14(value22, value16, value17, value23, false).catch(
            (input3?: Dynamic): Dynamic => (
              value10({
                type: "restart",
                from: value16.version,
                to: value17.version,
                reason: "apply-failed",
                asked: true,
                error: PlatformFilesHotReloadSlice(input3),
              }),
              value11("apply-failed"),
              "applied"
            ),
          );
        }
        return value18 && typeof input2.defer == "function"
          ? (input2.defer(),
            (state.deferred += 1),
            value10({
              ...state2,
              decision: "defer",
              why:
                value21 +
                "; the person is mid-gesture or typing, so the restart waits",
            }),
            value10({
              type: "deferred",
              from: value16.version,
              to: value17.version,
              reason: value19,
            }),
            value11("deferred-update", input.busyPollMs ?? 250),
            "deferred")
          : ((state.restarts += 1),
            value10({
              ...state2,
              decision: "restart",
              why: value21,
            }),
            value10({
              type: "restart",
              from: value16.version,
              to: value17.version,
              reason: value19,
              asked: true,
            }),
            callback2(
              value19 === "code"
                ? "code changed"
                : "required: " + String(input2.required),
            ),
            void input2.restart?.());
      }
      try {
        input2.adopt?.();
      } catch (value21: Dynamic) {
        value10({
          ...state2,
          decision: "restart",
          why: "u.adopt() threw: " + PlatformFilesHotReloadSlice(value21),
        });
        callback2("adopt failed");
        return void input2.restart?.();
      }
      value10({
        ...state2,
        decision: "adopt",
        why:
          input2.changed === null
            ? "the shell sent no diff (changed: null); the listing is diffed after adopt"
            : "content only",
      });
      let value20: Dynamic = callback();
      try {
        value3.noteAdopted?.(value17, value16);
      } catch {}
      return value14(input2.changed, value16, value17, value20, false).catch(
        (input3?: Dynamic): Dynamic => (
          value10({
            type: "restart",
            from: value16.version,
            to: value17.version,
            reason: "apply-failed",
            asked: true,
            error: PlatformFilesHotReloadSlice(input3),
          }),
          value11("apply-failed"),
          "applied"
        ),
      );
    }
    async function value14(
      input2?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value16?: Dynamic,
      extra?: Dynamic,
    ): Promise<Dynamic> {
      let index: Dynamic = 0,
        flag2: Dynamic = false,
        callback3: Dynamic = (
          input3?: Dynamic,
          options2?: Dynamic,
        ): Dynamic => (
          value10({
            type: "restart",
            from: options.version,
            to: context.version,
            reason: input3,
            asked: true,
            ...(options2 !== undefined
              ? {
                  error: PlatformFilesHotReloadSlice(options2),
                }
              : {}),
          }),
          value11(input3),
          "applied"
        ),
        callback4: Dynamic = (input3?: Dynamic): Dynamic => {
          let value24: Dynamic = input3?.status;
          return typeof value24 == "number" ? value24 : undefined;
        },
        callback5: Dynamic = (
          input3?: Dynamic,
          options2?: Dynamic,
        ): Dynamic => {
          let index2: Dynamic = 0;
          return (0, runtime.retryAccessFailure)(
            (): Dynamic => ((index2 += 1), options2()),
            value6,
            (input4?: Dynamic, options3?: Dynamic): Dynamic => {
              index += 1;
              state.fetchRetries += 1;
              let value24: Dynamic = callback4(options3),
                value25: Dynamic = options3?.redirectedTo;
              value10({
                type: "fetch",
                to: context.version,
                path: input3,
                attempt: input4,
                ok: false,
                ...(value24 !== undefined
                  ? {
                      status: value24,
                    }
                  : {}),
                msAfterAdopt: callback() - value16,
                ...(typeof value25 == "string"
                  ? {
                      redirectedTo: value25,
                    }
                  : {}),
              });
              input4 >= PlatformFilesHotReloadLimit &&
                !flag2 &&
                ((flag2 = true),
                value10({
                  type: "pending",
                  from: options.version,
                  to: context.version,
                  paths: [input3],
                  msAfterAdopt: callback() - value16,
                }));
            },
            value5,
          ).then(
            (input4?: Dynamic): Dynamic => (
              value10({
                type: "fetch",
                to: context.version,
                path: input3,
                attempt: index2,
                ok: true,
                msAfterAdopt: callback() - value16,
              }),
              input4
            ),
          );
        },
        value17: Dynamic;
      try {
        value17 =
          input2 === null
            ? await callback5("_files.json", value12)
            : input2.map(
                (input3?: Dynamic): Dynamic => ({
                  path: input3.path,
                  sha256: PlatformFilesHotReloadKind(input3),
                }),
              );
      } catch (value24: Dynamic) {
        return callback3("fetch-exhausted", value24);
      }
      if (
        input2 === null &&
        value17.some((input3?: Dynamic): Dynamic => value4(input3.path))
      )
        if (
          input.contentWhileBusy !== false &&
          input.isBusy?.() === true &&
          value17.some((input3?: Dynamic): Dynamic => !value4(input3.path))
        ) {
          value10({
            type: "restart",
            from: options.version,
            to: context.version,
            reason: "code-after-adopt",
            asked: true,
          });
          value11("code-after-adopt");
          value17 = value17.filter(
            (input3?: Dynamic): Dynamic => !value4(input3.path),
          );
        } else return callback3("code-after-adopt");
      if (value9 !== undefined && input2 !== null)
        for (let value24 of value17 as Dynamic)
          value24.sha256 === null
            ? value9.delete(value24.path)
            : value9.set(value24.path, value24.sha256);
      value17 = value17.filter(
        (input3?: Dynamic): Dynamic =>
          value3.olderThanMyWrite?.(context.version, input3.path) !== true,
      );
      let value18: Dynamic = extra
        ? value17.slice()
        : value17.filter((input3?: Dynamic): Dynamic => {
            let value24: Dynamic = value3.heldSha?.(input3.path);
            if (value24 === undefined || value24 !== input3.sha256) return true;
            let value25: Dynamic = value3.liveSha?.(input3.path);
            return value25 !== undefined && value25 !== input3.sha256;
          });
      try {
        value3.noteIncoming?.(value17);
      } catch {}
      let callback6: Dynamic = (input3?: Dynamic): Dynamic => {
          try {
            return value3.answersByReference?.(input3) === true;
          } catch {
            return false;
          }
        },
        value19: Dynamic = value18.filter(
          (input3?: Dynamic): Dynamic => input3.sha256 !== null,
        ),
        value20: Dynamic = value19.filter(
          (input3?: Dynamic): Dynamic => !callback6(input3.path),
        ),
        entries: Dynamic = new Map(),
        value21: Dynamic,
        value22: Dynamic;
      if (value20.length === 0 && value19.length > 0 && input2 !== null)
        try {
          await callback5(
            "_files.json",
            (): Dynamic => (0, runtime.listWritableFiles)(value2),
          );
          value21 = callback() - value16;
        } catch (value24: Dynamic) {
          return callback3("fetch-exhausted", value24);
        }
      let value23: Dynamic = await Promise.all(
        value20.map(
          (input3?: Dynamic): Dynamic =>
            callback5(
              input3.path,
              (): Dynamic => value2.readBytes(input3.path),
            ).then(
              (input4?: Dynamic): Dynamic => {
                value21 ??= callback() - value16;
                let state3: Dynamic = {
                  ...input4,
                  sha256: input3.sha256 ?? input4.sha256,
                };
                entries.set(input3.path, state3);
                try {
                  value3.primeRead?.(input3.path, state3);
                } catch {}
                return true;
              },
              (input4?: Dynamic): Dynamic => ((value22 = input4), false),
            ),
        ),
      );
      value21 !== undefined &&
        ((state.lastGrantLagMs = value21),
        (state.maxGrantLagMs = Math.max(state.maxGrantLagMs ?? 0, value21)));
      if (value23.includes(false)) return callback3("fetch-exhausted", value22);
      let state2: Dynamic = {
        from: options,
        to: context,
        changed: value18,
      };
      try {
        value18.length > 0 && (await input.applyRemote(state2, entries));
      } catch (value24: Dynamic) {
        return callback3("apply-failed", value24);
      }
      try {
        value3.noteRemote?.(state2);
      } catch {}
      state.applied += 1;
      value10({
        type: "applied",
        from: options.version,
        to: context.version,
        rows: value17.length,
        applied: value18.length,
        fetched: entries.size,
        ...(value19.length > value20.length
          ? {
              skipped: value19.length - value20.length,
            }
          : {}),
        retries: index,
        ...(value21 !== undefined
          ? {
              grantLagMs: value21,
            }
          : {}),
        ms: callback() - value16,
        paths: value18.map((input3?: Dynamic): Dynamic => input3.path),
        ...(extra
          ? {
              early: true,
            }
          : {}),
      });
      return "applied";
    }
    let value15: Dynamic =
      input.early ?? (0, runtime.getHotReloadController)(value);
    input.snapshot !== undefined &&
      typeof value.snapshot == "function" &&
      value.snapshot(
        (input2?: Dynamic): Dynamic =>
          flag ? undefined : input.snapshot(input2),
      );
    value15?.attach === undefined &&
      (input.restore !== undefined || input.reveal !== undefined) &&
      typeof value.ready == "function" &&
      value.ready((input2?: Dynamic): Dynamic => {
        if (!flag) {
          try {
            input.restore?.(input2);
          } catch {}
          return input.reveal === undefined
            ? undefined
            : awaitHotRestartReady(input.reveal, {
                holdMs: input.revealHoldMs,
                timers: value6,
                carried: input2 != null,
                onEvent: value10,
              });
        }
      });
    value.accept(value13);
    if (value15 !== undefined) {
      value15.attach?.({
        ...(input.snapshot !== undefined
          ? {
              snapshot: (input2?: Dynamic): Dynamic =>
                flag ? undefined : input.snapshot(input2),
            }
          : {}),
        ...(input.restore !== undefined
          ? {
              restore: (input2?: Dynamic): Dynamic => {
                flag || input.restore(input2);
              },
            }
          : {}),
        ...(input.reveal !== undefined
          ? {
              reveal: input.reveal,
            }
          : {}),
        onEvent: value10,
        onBeforeRestart: callback2,
      });
      value15.release();
      let value16: Dynamic = value15.takeOwed?.();
      value16 !== undefined &&
        (value10({
          type: "restart",
          from: value16.from.version,
          to: value16.to.version,
          reason: "deferred-update",
          asked: true,
        }),
        value11("deferred-update", input.busyPollMs ?? 250));
      let value17: Dynamic = value15.queued.splice(0);
      if (value17.length > 0) {
        let value18: Dynamic = value17.some(
            (input2?: Dynamic): Dynamic => input2.changed === null,
          ),
          entries: Dynamic = new Map();
        if (!value18)
          for (let value21 of value17 as Dynamic)
            for (let value22 of value21.changed as Dynamic)
              entries.set(value22.path, value22);
        let value19: Dynamic = value17[0],
          value20: Dynamic = value17[value17.length - 1];
        state.updates += value17.length;
        try {
          value3.noteAdopted?.(value20.to, value19.from);
        } catch {}
        value14(
          value18 ? null : [...entries.values()],
          value19.from,
          value20.to,
          value19.at,
          true,
        ).catch((input2?: Dynamic): Dynamic => {
          value10({
            type: "restart",
            from: value19.from.version,
            to: value20.to.version,
            reason: "apply-failed",
            asked: true,
            error: PlatformFilesHotReloadSlice(input2),
          });
          value11("apply-failed");
        });
      }
    }
    return {
      get active(): Dynamic {
        return !flag;
      },
      stats: (): Dynamic => ({
        ...state,
      }),
      events: items,
      dispose(): Dynamic {
        flag = true;
        value7 !== undefined &&
          (value6.clearTimeout(value7), (value7 = undefined));
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadItems",
    () => PlatformFilesHotReloadItems,
    (value) => {
      PlatformFilesHotReloadItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadLimit",
    () => PlatformFilesHotReloadLimit,
    (value) => {
      PlatformFilesHotReloadLimit = value;
    },
  );
  bindRuntimeValue(runtime, "getHotCapability", () => getHotCapability);
  bindRuntimeValue(runtime, "hasHotRestartToken", () => hasHotRestartToken);
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadName",
    () => PlatformFilesHotReloadName,
    (value) => {
      PlatformFilesHotReloadName = value;
    },
  );
  bindRuntimeValue(runtime, "canHotRestart", () => canHotRestart);
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadLimit_2",
    () => PlatformFilesHotReloadLimit_2,
    (value) => {
      PlatformFilesHotReloadLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadLimit_3",
    () => PlatformFilesHotReloadLimit_3,
    (value) => {
      PlatformFilesHotReloadLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadLimit_4",
    () => PlatformFilesHotReloadLimit_4,
    (value) => {
      PlatformFilesHotReloadLimit_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadKind",
    () => PlatformFilesHotReloadKind,
    (value) => {
      PlatformFilesHotReloadKind = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadSlice",
    () => PlatformFilesHotReloadSlice,
    (value) => {
      PlatformFilesHotReloadSlice = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadVer",
    () => PlatformFilesHotReloadVer,
    (value) => {
      PlatformFilesHotReloadVer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadPath",
    () => PlatformFilesHotReloadPath,
    (value) => {
      PlatformFilesHotReloadPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadAdopt",
    () => PlatformFilesHotReloadAdopt,
    (value) => {
      PlatformFilesHotReloadAdopt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFilesHotReloadConstant",
    () => PlatformFilesHotReloadConstant,
    (value) => {
      PlatformFilesHotReloadConstant = value;
    },
  );
  bindRuntimeValue(runtime, "awaitHotRestartReady", () => awaitHotRestartReady);
  bindRuntimeValue(
    runtime,
    "createFilesHotReloadController",
    () => createFilesHotReloadController,
  );
  return () => {
    PlatformFilesHotReloadItems = [
      150, 300, 600, 1e3, 2e3, 2e3, 2e3, 2e3, 2e3, 2e3, 2e3, 2e3,
    ];
    PlatformFilesHotReloadLimit = 4;
    PlatformFilesHotReloadName = (): Dynamic => {
      try {
        return typeof window === "undefined"
          ? ""
          : String((window as Dynamic).name ?? "");
      } catch {
        return "";
      }
    };
    PlatformFilesHotReloadLimit_2 = 6e4;
    PlatformFilesHotReloadLimit_3 = 1;
    PlatformFilesHotReloadLimit_4 = 50;
    PlatformFilesHotReloadKind = (source?: Dynamic): Dynamic =>
      source.kind === "removed"
        ? null
        : typeof source.to == "string"
          ? source.to
          : null;
    PlatformFilesHotReloadSlice = (input?: Dynamic): Dynamic =>
      (input instanceof Error
        ? input.message
        : String(input?.message ?? input)
      ).slice(0, 120);
    PlatformFilesHotReloadVer = (input?: Dynamic): Dynamic => ({
      version: input.ver,
      ...(input.seq !== undefined
        ? {
            seq: input.seq,
          }
        : {}),
    });
    PlatformFilesHotReloadPath = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      input === null
        ? null
        : input.map(
            (source?: Dynamic): Dynamic => ({
              path: source.path,
              kind: String(source.kind),
              klass: options(source.path) ? "code" : "content",
            }),
          );
    PlatformFilesHotReloadAdopt = (input?: Dynamic): Dynamic =>
      typeof input.adopt == "function" ? "calls" : "string";
    PlatformFilesHotReloadConstant = 4500;
  };
}
