/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFastEditController(
  runtime: RuntimeBindings,
): () => void {
  var FAST_EDIT_COMPLETION_MESSAGES: Dynamic;
  var COMMENT_FAST_EDIT_TIMEOUT_MS: Dynamic;
  var COMMENT_FAST_EDIT_MAX_CALLS: Dynamic;
  var MAX_COMMENT_FAST_EDIT_PROMPT_CHARS: Dynamic;
  var FAST_EDIT_HANDOFF_CODES: Dynamic;
  var FAST_EDIT_REFUSED_CODES: Dynamic;
  var classifyFastEditHandoffOutcome: Dynamic;
  var FAST_EDIT_HANDOFF_MESSAGES: Dynamic;
  var KNOWN_FAST_EDIT_HANDOFF_CODES: Dynamic;
  var FAST_EDIT_TEMPLATE_GATE_CODES: Dynamic;
  var FAST_EDIT_GATE_ERROR_CODES: Dynamic;
  var FAST_EDIT_CAP_ERROR_CODES: Dynamic;
  var isKnownFastEditCode: Dynamic;
  var describeFastEditHandoff: Dynamic;
  var sleepFastEdit: Dynamic;
  var MAX_FAST_EDIT_CLICK_CONTEXT_CHARS: Dynamic;
  var COMMENT_NEAREST_ARTBOARD_DISTANCE: Dynamic;
  function truncateUtf8Text(text?: Dynamic, maxBytes?: Dynamic): Dynamic {
    let encoder: Dynamic = new TextEncoder(),
      result: Dynamic = "",
      bytes: Dynamic = 0;
    for (let value of text as Dynamic) {
      bytes += encoder.encode(value).length;
      if (bytes > maxBytes) break;
      result += value;
    }
    return result.trim();
  }
  function commentPinnedFile(anchor?: Dynamic, files?: Dynamic): Dynamic {
    let pin2: Dynamic =
      anchor === null ? null : (0, runtime.parseDesignCommentAnchor)(anchor);
    return pin2 === null || !("fileHash" in pin2)
      ? null
      : (files.find(
          (input?: Dynamic): Dynamic =>
            (0, runtime.stableAnchorHash)(input) === pin2.fileHash,
        ) ?? null);
  }
  function findNearbyCommentArtboards(
    boards?: Dynamic,
    x?: Dynamic,
    y?: Dynamic,
    accept?: Dynamic,
  ): Dynamic {
    let ranked: Dynamic = boards.map((input?: Dynamic): Dynamic => {
      let value: Dynamic = Math.max(input.x - x, x - (input.x + input.w), 0),
        value2: Dynamic = Math.max(input.y - y, y - (input.y + input.h), 0);
      return {
        file: input.file,
        far: Math.hypot(value, value2),
        px: Math.round(Math.max(value, value2)),
        side:
          value >= value2
            ? x < input.x
              ? "left"
              : "right"
            : y < input.y
              ? "above"
              : "below",
      };
    });
    return ranked.every(
      (input?: Dynamic): Dynamic => Number.isFinite(input.far) && input.far > 0,
    )
      ? ranked
          .filter(
            (input?: Dynamic): Dynamic =>
              input.far <= COMMENT_NEAREST_ARTBOARD_DISTANCE &&
              accept(input.file),
          )
          .sort(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              input.far - options.far,
          )
          .slice(0, 2)
          .map(
            ({ file: file, px: px2, side: side }: Dynamic): Dynamic => ({
              file: file,
              px: px2,
              side: side,
            }),
          )
      : null;
  }
  async function resolveCommentFastEditTarget(
    comment?: Dynamic,
    boards?: Dynamic,
    request?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    let isValidRectangle: Dynamic = (input?: Dynamic): Dynamic =>
      input !== null &&
      [input.x, input.y, input.w, input.h].every(
        (input2?: Dynamic): Dynamic => Number.isFinite(input2),
      ) &&
      input.w > 0 &&
      input.h > 0;
    if (comment === null) return {};
    if (comment.kind === "artboard" && "px" in comment) {
      let value: Dynamic =
        (await context?.().catch((): Dynamic => null)) ?? null;
      return {
        ground: true,
        x: comment.px + (value?.x ?? 0),
        y: comment.py + (value?.y ?? 0),
        page: {
          x: comment.px,
          y: comment.py,
        },
      };
    }
    if (comment.kind === "artboard" && comment.fy === 0) return {};
    if (comment.kind === "artboard") {
      let value: Dynamic =
          (await context?.().catch((): Dynamic => null)) ?? null,
        value2: Dynamic = comment.fx * boards.w,
        value3: Dynamic = comment.fy * boards.h;
      return {
        ground: true,
        x: value2,
        y: value3,
        ...(isValidRectangle(value)
          ? {
              page: {
                x: value2 - value.x,
                y: value3 - value.y,
              },
            }
          : {}),
      };
    }
    if (comment.kind === "el") {
      let value: Dynamic = await request(
        comment.path,
        comment.tid,
        comment.fp,
      ).catch((): Dynamic => null);
      return isValidRectangle(value)
        ? {
            x: value.x + comment.fx * value.w,
            y: value.y + comment.fy * value.h,
          }
        : {};
    }
    if (comment.kind === "area") {
      let value: Dynamic =
        comment.path === null
          ? {
              x: 0,
              y: 0,
              w: boards.w,
              h: boards.h,
            }
          : await request(comment.path, comment.tid, comment.fp).catch(
              (): Dynamic => null,
            );
      return isValidRectangle(value)
        ? {
            area: {
              x: value.x + comment.box.x0 * value.w,
              y: value.y + comment.box.y0 * value.h,
              w: (comment.box.x1 - comment.box.x0) * value.w,
              h: (comment.box.y1 - comment.box.y0) * value.h,
            },
          }
        : {};
    }
    return {};
  }
  function createFastEditController(
    getContext?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let lastOutcome: Dynamic = null,
      activeRequest: Dynamic = null,
      undoAppliedChanges: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
      ): Promise<Dynamic> => {
        let value: Dynamic = options2;
        for (let index: Dynamic = 0; index < input; index++) {
          let value2: Dynamic = getContext()?.host().canvas;
          if (value2 === undefined || value2.mark() !== value) return "changed";
          value2.undo();
          for (
            let index3: Dynamic = 0;
            index3 < MAX_FAST_EDIT_CLICK_CONTEXT_CHARS &&
            value2.mark() === value;
            index3++
          )
            await sleepFastEdit(40);
          if (value2.mark() === value) return "changed";
          let index2: Dynamic = 0;
          for (
            let index3: Dynamic = 0, value3: Dynamic = value2.mark();
            index3 < MAX_FAST_EDIT_CLICK_CONTEXT_CHARS && index2 < 3;
            index3++
          ) {
            await sleepFastEdit(40);
            let value4: Dynamic = value2.mark();
            value4 === value3
              ? (index2 += 1)
              : ((value3 = value4), (index2 = 0));
          }
          if (index2 < 3) return "changed";
          value = value2.mark();
        }
        return "undone";
      },
      tryUndo: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        undoAppliedChanges(input, options2).catch((): Dynamic => "changed"),
      runCommentRequest: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Promise<Dynamic> => {
        let value: Dynamic = performance.now(),
          value2: Dynamic = null;
        activeRequest = null;
        let text: Dynamic = "not_applied",
          index: Dynamic = 0,
          callback: Dynamic = (
            input2?: Dynamic,
            options3?: Dynamic,
            context2?: Dynamic,
            value16?: Dynamic,
          ): Dynamic => (
            (lastOutcome = {
              outcome: input2,
              code: options3,
              forClaude: "",
              calls: 0,
              skipped: index,
              msFirst: value2,
              ms: Math.round(performance.now() - value),
              ...context2,
            }),
            lastOutcome.calls === 0 &&
              input?.onNoCall?.({
                outcome: input2,
                code: options3,
                calls: 0,
                ms: lastOutcome.ms,
              }),
            input !== null &&
              (0, runtime.finishFastEditJournalTurn)(
                input.session,
                input2 === "done"
                  ? "done"
                  : input2 === "stopped"
                    ? null
                    : options3 === "ask_claude"
                      ? "handed"
                      : text,
                (0, runtime.stableAnchorHash)(options2.anchor ?? ""),
              ),
            input2 === "done"
              ? {
                  handled: true,
                  ...(value16 !== undefined
                    ? {
                        reply: value16,
                      }
                    : {}),
                }
              : value16 !== undefined
                ? {
                    handled: false,
                    reply: value16,
                  }
                : null
          );
        if (input === null) return callback("error", "no_fast_track");
        let value3: Dynamic =
            options2.anchor === null
              ? null
              : (0, runtime.parseDesignCommentAnchor)(options2.anchor),
          value4: Dynamic =
            value3?.kind === "canvas"
              ? input.inView(
                  input
                    .host()
                    .canvas.boards()
                    .map((input2?: Dynamic): Dynamic => input2.file),
                )
              : [],
          value5: Dynamic =
            value3?.kind === "canvas" &&
            input
              .host()
              .canvas.pageIs(
                (input2?: Dynamic): Dynamic =>
                  (0, runtime.stableAnchorHash)(input2) === value3.pageHash,
              )
              ? findNearbyCommentArtboards(
                  input.host().canvas.boards(),
                  value3.x,
                  value3.y,
                  (input2?: Dynamic): Dynamic => value4.includes(input2),
                )
              : null,
          value6: Dynamic = value5 ?? [],
          value7: Dynamic =
            value5 !== null && value5.length === 0 ? value4.slice(0, 2) : [],
          value8: Dynamic =
            commentPinnedFile(
              options2.anchor,
              input
                .host()
                .canvas.boards()
                .map((input2?: Dynamic): Dynamic => input2.file),
            ) ??
            value6[0]?.file ??
            value7[0] ??
            (value5 !== null ? "" : null);
        if (value8 === null) return callback("handed_on", "no_target");
        let value9: Dynamic = input
            .host()
            .canvas.boards()
            .find((input2?: Dynamic): Dynamic => input2.file === value8) ?? {
            w: 0,
            h: 0,
          },
          value10: Dynamic = await resolveCommentFastEditTarget(
            value3,
            value9,
            async (
              input2?: Dynamic,
              options3?: Dynamic,
              context2?: Dynamic,
            ): Promise<Dynamic> =>
              (
                await input.rectsOf?.(value8, [
                  {
                    path: input2,
                    tid: options3,
                    ...(context2 !== undefined
                      ? {
                          fp: context2,
                        }
                      : {}),
                  },
                ])
              )?.[0] ?? null,
            async (): Promise<Dynamic> =>
              (
                await input.rectsOf?.(value8, [
                  {
                    page: true,
                  },
                ])
              )?.[0] ?? null,
          );
        input.session.turn = {
          file: value8,
        };
        let value11: Dynamic = await (0, runtime.applyFastEditRequest)(
          {
            ...input,
            held: true,
            allOrNothing: true,
            maxCalls: COMMENT_FAST_EDIT_MAX_CALLS,
            target: value8,
            ...((value6[1]?.file ?? value7[1]) !== undefined
              ? {
                  second: value6[1]?.file ?? value7[1],
                }
              : {}),
            ...(value7.length > 0
              ? {
                  contextOnly: true,
                }
              : {}),
            comment: {
              click: value10,
              ...(value5 !== null && value3?.kind === "canvas"
                ? {
                    between: value6,
                    pin: {
                      x: value3.x,
                      y: value3.y,
                    },
                  }
                : {}),
              ...(value3?.kind === "el"
                ? {
                    path: value3.path,
                    tid: value3.tid,
                    ...(value3.fp !== undefined
                      ? {
                          fp: true,
                        }
                      : {}),
                  }
                : {}),
            },
            onStatement: (): Dynamic => {
              value2 ??= Math.round(performance.now() - value);
            },
          },
          {
            id: "ft" + Date.now().toString(36),
            words: options2.text,
            images: [],
            tier: options.tier?.() ?? "quick",
            signal: context.signal,
            report: (): Dynamic => {},
          },
        );
        (0, runtime.reportFastEditOutcome)(value11);
        index = value11.skipped ?? 0;
        let value12: Dynamic = value11.steps ?? 0,
          value13: Dynamic = value11.mark ?? null;
        if (
          value11.outcome === "saved" &&
          value11.whole === true &&
          !context.signal.aborted
        ) {
          let value16: Dynamic = callback(
            "done",
            value11.code,
            {
              calls: value11.calls,
              changed: value11.changed ?? [],
            },
            value11.made.removed > 0
              ? FAST_EDIT_COMPLETION_MESSAGES.removed(value11.made.removed)
              : value11.inList === true
                ? FAST_EDIT_COMPLETION_MESSAGES.in_list
                : undefined,
          );
          value13 !== null &&
            (activeRequest = {
              records: value12,
              mark: value13,
            });
          return value16;
        }
        if (value11.unsaved === "save_clash" && !context.signal.aborted) {
          text = "unconfirmed";
          return callback(
            "refused",
            value11.unsaved,
            {
              calls: value11.calls,
              forClaude: describeFastEditHandoff(
                value11.unsaved,
                value11.unsaved,
              ),
            },
            FAST_EDIT_COMPLETION_MESSAGES.save_clash,
          );
        }
        if (value12 > 0) {
          let value16: Dynamic =
              value13 === null ? "changed" : await tryUndo(value12, value13),
            value17: Dynamic =
              value16 === "undone" ? "part_taken_back" : "part_left";
          if (value16 === "undone") {
            await (0, runtime.withFastEditTimeout)(
              (async (): Promise<Dynamic> =>
                Promise.all(
                  [...(input.host().handlesRef.current?.values() ?? [])].map(
                    (input2?: Dynamic): Dynamic =>
                      (async (): Promise<Dynamic> => {
                        input2.hasPendingEdits() &&
                          (await input2.flushPending());
                      })().catch((): Dynamic => {}),
                  ),
                ))().catch((): Dynamic => {}),
              runtime.FAST_EDIT_SANDBOX_START_TIMEOUT_MS,
            );
            try {
              input.host().saveNow();
            } catch {}
          } else
            text = (
              {
                stands: "left",
                gone: "not_applied",
                neither: "left_changed",
              } as Dynamic
            )[
              await (0, runtime.updateFastEditHistoryFromCanvas)(input).catch(
                (): Dynamic => "neither",
              )
            ];
          return context.signal.aborted
            ? callback("stopped", value17, {
                calls: value11.calls,
              })
            : callback("error", value17, {
                calls: value11.calls,
                forClaude: describeFastEditHandoff(
                  value16 === "undone" ? "taken_back" : "left",
                  value17,
                ),
              });
        }
        if (value11.outcome === "stopped" || context.signal.aborted)
          return callback(
            "stopped",
            context.signal.reason === "too_slow" ? "too_slow" : "cancelled",
            {
              calls: value11.calls,
            },
          );
        let value14: Dynamic = classifyFastEditHandoffOutcome(value11.code),
          value15: Dynamic =
            value11.code === "ask_claude"
              ? truncateUtf8Text(
                  value11.forClaude ?? "",
                  COMMENT_FAST_EDIT_TIMEOUT_MS,
                )
              : "";
        return callback(value14, value11.code, {
          calls: value11.calls,
          forClaude:
            value15 !== ""
              ? value15
              : describeFastEditHandoff(
                  value11.code === "not_named" || value11.code === "in_import"
                    ? value11.code
                    : value11.calls === 0 &&
                        (value11.code === "slow_start" ||
                          value11.code === "start_stuck")
                      ? "not_started"
                      : value14 === "refused"
                        ? "refused"
                        : value14 === "handed_on"
                          ? "nothing"
                          : "failed",
                  value11.code === "save_clash" ||
                    value11.code === "save_unknown"
                    ? ""
                    : value11.code,
                ),
        });
      };
    return {
      fastTrack: async (
        input?: Dynamic,
        options2?: Dynamic,
      ): Promise<Dynamic> => {
        let value: Dynamic = getContext(),
          value2: Dynamic = value?.session;
        if (value2 !== undefined && value2.busy !== null) {
          lastOutcome = {
            outcome: "error",
            code: "busy",
            forClaude: "",
            calls: 0,
            msFirst: null,
            ms: 0,
          };
          return null;
        }
        value2 !== undefined && (value2.busy = "comment");
        let controller: Dynamic = new AbortController(),
          callback: Dynamic = (): Dynamic => controller.abort(),
          value3: Dynamic =
            options.timer ??
            ((input2?: Dynamic, options3?: Dynamic): Dynamic => {
              let value5: Dynamic = setTimeout(options3, input2);
              return (): Dynamic => clearTimeout(value5);
            }),
          value4: Dynamic = value3(
            MAX_COMMENT_FAST_EDIT_PROMPT_CHARS,
            (): Dynamic => controller.abort("too_slow"),
          );
        options2.signal.aborted
          ? callback()
          : options2.signal.addEventListener("abort", callback, {
              once: true,
            });
        try {
          return await runCommentRequest(value, input, {
            signal: controller.signal,
          });
        } finally {
          value4();
          options2.signal.removeEventListener("abort", callback);
          value2 !== undefined && (value2.busy = null);
        }
      },
      side: {
        last: (): Dynamic => lastOutcome,
        undo: async (): Promise<Dynamic> => {
          let value: Dynamic = activeRequest;
          activeRequest = null;
          return value === null
            ? lastOutcome?.outcome === "done"
              ? "changed"
              : "nothing"
            : tryUndo(value.records, value.mark);
        },
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_COMPLETION_MESSAGES",
    () => FAST_EDIT_COMPLETION_MESSAGES,
    (value) => {
      FAST_EDIT_COMPLETION_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_FAST_EDIT_TIMEOUT_MS",
    () => COMMENT_FAST_EDIT_TIMEOUT_MS,
    (value) => {
      COMMENT_FAST_EDIT_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_FAST_EDIT_MAX_CALLS",
    () => COMMENT_FAST_EDIT_MAX_CALLS,
    (value) => {
      COMMENT_FAST_EDIT_MAX_CALLS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COMMENT_FAST_EDIT_PROMPT_CHARS",
    () => MAX_COMMENT_FAST_EDIT_PROMPT_CHARS,
    (value) => {
      MAX_COMMENT_FAST_EDIT_PROMPT_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_HANDOFF_CODES",
    () => FAST_EDIT_HANDOFF_CODES,
    (value) => {
      FAST_EDIT_HANDOFF_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_REFUSED_CODES",
    () => FAST_EDIT_REFUSED_CODES,
    (value) => {
      FAST_EDIT_REFUSED_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyFastEditHandoffOutcome",
    () => classifyFastEditHandoffOutcome,
    (value) => {
      classifyFastEditHandoffOutcome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_HANDOFF_MESSAGES",
    () => FAST_EDIT_HANDOFF_MESSAGES,
    (value) => {
      FAST_EDIT_HANDOFF_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KNOWN_FAST_EDIT_HANDOFF_CODES",
    () => KNOWN_FAST_EDIT_HANDOFF_CODES,
    (value) => {
      KNOWN_FAST_EDIT_HANDOFF_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_TEMPLATE_GATE_CODES",
    () => FAST_EDIT_TEMPLATE_GATE_CODES,
    (value) => {
      FAST_EDIT_TEMPLATE_GATE_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_GATE_ERROR_CODES",
    () => FAST_EDIT_GATE_ERROR_CODES,
    (value) => {
      FAST_EDIT_GATE_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_CAP_ERROR_CODES",
    () => FAST_EDIT_CAP_ERROR_CODES,
    (value) => {
      FAST_EDIT_CAP_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isKnownFastEditCode",
    () => isKnownFastEditCode,
    (value) => {
      isKnownFastEditCode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeFastEditHandoff",
    () => describeFastEditHandoff,
    (value) => {
      describeFastEditHandoff = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sleepFastEdit",
    () => sleepFastEdit,
    (value) => {
      sleepFastEdit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_CLICK_CONTEXT_CHARS",
    () => MAX_FAST_EDIT_CLICK_CONTEXT_CHARS,
    (value) => {
      MAX_FAST_EDIT_CLICK_CONTEXT_CHARS = value;
    },
  );
  bindRuntimeValue(runtime, "truncateUtf8Text", () => truncateUtf8Text);
  bindRuntimeValue(runtime, "commentPinnedFile", () => commentPinnedFile);
  bindRuntimeValue(
    runtime,
    "COMMENT_NEAREST_ARTBOARD_DISTANCE",
    () => COMMENT_NEAREST_ARTBOARD_DISTANCE,
    (value) => {
      COMMENT_NEAREST_ARTBOARD_DISTANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findNearbyCommentArtboards",
    () => findNearbyCommentArtboards,
  );
  bindRuntimeValue(
    runtime,
    "resolveCommentFastEditTarget",
    () => resolveCommentFastEditTarget,
  );
  bindRuntimeValue(
    runtime,
    "createFastEditController",
    () => createFastEditController,
  );
  return () => {
    FAST_EDIT_COMPLETION_MESSAGES = {
      in_list:
        "Done. This element is drawn once for every item of a list, so the change shows on all of them.",
      save_clash:
        // CucCut: user-facing copy calls the agent "the agent", not Claude.
        "Somebody else saved this artboard at the same moment, so one of the two changes may not have been kept. The comment has gone on to the agent.",
      removed: (input?: Dynamic): Dynamic =>
        input === 1
          ? "1 artboard deleted. One undo brings it back."
          : `${input} artboards deleted. One undo brings them back.`,
    };
    COMMENT_FAST_EDIT_TIMEOUT_MS = 1e3;
    COMMENT_FAST_EDIT_MAX_CALLS = 3;
    MAX_COMMENT_FAST_EDIT_PROMPT_CHARS = 8e4;
    FAST_EDIT_HANDOFF_CODES = new Set([
      "ask_claude",
      "not_named",
      "in_import",
      "words_only",
      "no_match",
      "already_so",
      "no_change",
      "not_run",
      "empty_completion",
    ]);
    FAST_EDIT_REFUSED_CODES = new Set([
      "refused_add",
      "thrown",
      "empty_drawing",
      "beyond_target",
      "line_no_match",
    ]);
    classifyFastEditHandoffOutcome = (input?: Dynamic): Dynamic =>
      FAST_EDIT_HANDOFF_CODES.has(input)
        ? "handed_on"
        : FAST_EDIT_GATE_ERROR_CODES.has(input) ||
            FAST_EDIT_CAP_ERROR_CODES.has(input) ||
            FAST_EDIT_REFUSED_CODES.has(input)
          ? "refused"
          : "error";
    FAST_EDIT_HANDOFF_MESSAGES = {
      nothing: "This page looked at the request first and made no change.",
      refused:
        "This page tried the change first and its checks refused the result. Nothing was changed.",
      failed:
        "This page tried the change first and failed. Nothing was changed.",
      taken_back:
        "This page tried the change first and could not finish it. What it had changed was taken back.",
      left: "This page tried the change first and could not finish it. A part of the change is still on the artboard.",
      not_named:
        "This page could not tell which element of the template was clicked, so it changed nothing.",
      in_import:
        "The click is inside an imported component, which this page cannot change from this artboard.",
      not_started:
        "This page could not start its quick try in time. Nothing was changed.",
      save_clash:
        "This page made the change, but somebody else saved this artboard at the same moment, so the change may not have been kept, or theirs may not. Look at the artboard as it is now and finish the comment.",
      save_unknown:
        "This page made the change but could not confirm that it was saved. Look at the artboard as it is now and finish the comment.",
    };
    KNOWN_FAST_EDIT_HANDOFF_CODES = new Set([
      "not_named",
      "in_import",
      "words_only",
      "no_match",
      "already_so",
      "no_change",
      "not_run",
      "empty_completion",
      "beyond_target",
      "thrown",
      "line_no_match",
      "empty_drawing",
      "part_taken_back",
      "part_left",
      "save_clash",
      "save_unknown",
    ]);
    FAST_EDIT_TEMPLATE_GATE_CODES = {
      outside: true,
      too_big: true,
      box_cannot_hold: true,
      not_template: true,
      reparse: true,
    };
    FAST_EDIT_GATE_ERROR_CODES = new Set(
      [
        ...Object.keys(FAST_EDIT_TEMPLATE_GATE_CODES),
        "shape",
        "page_style",
        "reshaped",
        "changed",
        "data_cut",
      ].map((input?: Dynamic): Dynamic => "gate_" + input),
    );
    FAST_EDIT_CAP_ERROR_CODES = new Set(["cap_news"]);
    isKnownFastEditCode = (input?: Dynamic): Dynamic =>
      Object.hasOwn(runtime.FAST_EDIT_ERROR_MESSAGES, input) ||
      KNOWN_FAST_EDIT_HANDOFF_CODES.has(input) ||
      FAST_EDIT_GATE_ERROR_CODES.has(input) ||
      FAST_EDIT_CAP_ERROR_CODES.has(input);
    describeFastEditHandoff = (input?: Dynamic, options?: Dynamic): Dynamic =>
      FAST_EDIT_HANDOFF_MESSAGES[input] +
      (isKnownFastEditCode(options) ? " Code: " + options + "." : "");
    sleepFastEdit = (input?: Dynamic): Dynamic =>
      new Promise((input2?: Dynamic): Dynamic => setTimeout(input2, input));
    MAX_FAST_EDIT_CLICK_CONTEXT_CHARS = 50;
    COMMENT_NEAREST_ARTBOARD_DISTANCE = 400;
  };
}
