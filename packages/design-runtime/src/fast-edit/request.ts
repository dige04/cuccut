/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditRequest(runtime: RuntimeBindings): () => void {
  var selectedFastEditFile: Dynamic;
  var summarizeFastEditAppliedChanges: Dynamic;
  var serializePromptArtboardWithPageStyle: Dynamic;
  var stripReplyCodeFences: Dynamic;
  var stripReplyInlineBackticks: Dynamic;
  var JS_IDENTIFIER_PATTERN: Dynamic;
  var FAST_EDIT_REPLY_PREFIX_PATTERN: Dynamic;
  var BARE_FAST_EDIT_SELECTOR_PATTERN: Dynamic;
  function resolveFastEditFileTarget(
    request?: Dynamic,
    files?: Dynamic,
  ): Dynamic {
    if (request.target !== undefined)
      return request.target === "" || files.includes(request.target)
        ? {
            file: request.target,
            by: "selected",
          }
        : null;
    let value: Dynamic = selectedFastEditFile(request.host(), files);
    if (value !== undefined)
      return {
        file: value,
        by: "selected",
      };
    if (files.length === 0) return null;
    let value2: Dynamic = request.inView(files);
    return value2.length > 0
      ? value2.includes(request.session.lastTouched)
        ? {
            file: request.session.lastTouched,
            by: "last",
          }
        : {
            file: value2[0],
            by: "none",
          }
      : request.session.lastTouched !== "" &&
          files.includes(request.session.lastTouched)
        ? {
            file: request.session.lastTouched,
            by: "last",
          }
        : {
            file: files[0],
            by: "none",
          };
  }
  async function updateFastEditHistoryFromCanvas(
    context?: Dynamic,
  ): Promise<Dynamic> {
    let turn: Dynamic = context.session.turn,
      host: Dynamic = context.host(),
      handles: Dynamic = host.handlesRef.current ?? new Map(),
      boards: Dynamic = host.canvas.boards(),
      files: Dynamic = boards
        .map((input?: Dynamic): Dynamic => input.file)
        .slice(0, runtime.MAX_FAST_EDIT_FILES),
      idOf: Dynamic = (0, runtime.createFastEditFileIds)(files).idOf,
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(
        files.flatMap((input?: Dynamic): Dynamic => {
          try {
            return handles.get(input)?.pageFonts() ?? [];
          } catch {
            return [];
          }
        }),
      );
    for (let value of (turn === null
      ? []
      : [turn, ...(turn.also ?? [])]) as Dynamic) {
      let value2: Dynamic = boards.find(
          (input?: Dynamic): Dynamic => input.file === value.file,
        ),
        entry: Dynamic = idOf.get(value.file);
      if (value.how !== undefined) {
        values.add(
          (value2 !== undefined) == (value.how === "new") ? "stands" : "gone",
        );
        continue;
      }
      if (value.after === value.before) continue;
      let value3: Dynamic =
          value2 === undefined || entry === undefined
            ? null
            : await (0, runtime.withFastEditTimeout)(
                handles
                  .get(value.file)
                  ?.askTemplate()
                  .catch((): Dynamic => null) ?? Promise.resolve(null),
                2500,
              ),
        value4: Dynamic =
          typeof value3 == "string" &&
          value3.length <= runtime.MAX_FAST_EDIT_SECTION_CHARS
            ? serializePromptArtboardWithPageStyle(
                entry,
                value2,
                value3,
                values2,
              )
            : undefined;
      values.add(
        value4 !== undefined && value4 === value.after
          ? "stands"
          : value4 !== undefined && value4 === value.before
            ? "gone"
            : "neither",
      );
    }
    return values.size === 1 ? [...values][0] : "neither";
  }
  async function captureFastEditCanvasState(
    context?: Dynamic,
  ): Promise<Dynamic> {
    let host: Dynamic = context.host(),
      handles: Dynamic = host.handlesRef.current ?? new Map(),
      boards: Dynamic = host.canvas.boards(),
      session: Dynamic = context.session,
      ids: Dynamic = (0, runtime.createFastEditFileIds)(
        boards
          .map((input?: Dynamic): Dynamic => input.file)
          .slice(0, runtime.MAX_FAST_EDIT_FILES),
      ),
      value: Dynamic = [...ids.idOf.keys()].filter(
        (input?: Dynamic): Dynamic => handles.has(input),
      ),
      value2: Dynamic = null,
      index: Dynamic = 0,
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        session.unrecorded.has(input) || (index += 1);
        session.unrecorded.set(input, options);
      };
    session.first ??= new Set(
      boards.map((input?: Dynamic): Dynamic => input.file),
    );
    for (let value3 of boards as Dynamic)
      !handles.has(value3.file) &&
        !session.seen.has(value3.file) &&
        callback(value3.file, "late");
    for (let value3 of value as Dynamic) {
      if (
        session.seen.has(value3) ||
        session.unrecorded.get(value3) === "unfit"
      )
        continue;
      let entry: Dynamic = handles.get(value3);
      if (session.busy !== null) {
        index += 1;
        continue;
      }
      if (!entry.isReady()) {
        callback(value3, "late");
        continue;
      }
      let value4: Dynamic = await (0, runtime.withFastEditTimeout)(
        entry.askTemplate().catch((): Dynamic => null),
        2500,
      );
      if (!session.seen.has(value3)) {
        if (session.busy !== null) {
          index += 1;
          continue;
        }
        if (typeof value4 != "string" || value4.length > 2e5) {
          callback(value3, typeof value4 == "string" ? "unfit" : "late");
          continue;
        }
        value2 ??= new Set(
          value.flatMap((input?: Dynamic): Dynamic => {
            try {
              return handles.get(input)?.pageFonts() ?? [];
            } catch {
              return [];
            }
          }),
        );
        session.unrecorded.delete(value3);
        session.seen.set(
          value3,
          serializePromptArtboardWithPageStyle(
            ids.idOf.get(value3),
            boards.find((input?: Dynamic): Dynamic => input.file === value3),
            value4,
            value2,
          ),
        );
        session.first.has(value3) && session.opened.add(value3);
        await new Promise((input?: Dynamic): Dynamic => setTimeout(input, 0));
      }
    }
    return index;
  }
  function extractFastEditReplyStatements(
    reply?: Dynamic,
    partialLine: Dynamic = "",
  ): Dynamic {
    let statements: Dynamic = "",
      lastLine: Dynamic = "",
      depth: Dynamic = 0,
      accepting: Dynamic = true,
      inCode: Dynamic = false;
    for (let value of reply.split(/(?<=\n)/) as Dynamic) {
      if (value.trim() === "") {
        statements += value;
        continue;
      }
      if (
        lastLine === "" &&
        depth === 0 &&
        accepting &&
        !FAST_EDIT_REPLY_PREFIX_PATTERN.test(value + ";")
      ) {
        inCode = value.trim() === ".";
        continue;
      }
      statements +=
        (inCode && BARE_FAST_EDIT_SELECTOR_PATTERN.test(value) ? "." : "") +
        value;
      inCode = false;
      for (let index: Dynamic = 0; index < value.length; index++) {
        let value2: Dynamic = value[index],
          value3: Dynamic = value2 + (value[index + 1] ?? "");
        if (lastLine === "*")
          value3 === "*/" && ((lastLine = ""), (index += 1));
        else if (lastLine !== "")
          value2 === "\\"
            ? (index += 1)
            : value2 === lastLine && (lastLine = "");
        else {
          if (value3 === "//") break;
          value3 === "/*"
            ? ((lastLine = "*"), (index += 1))
            : value2 === "`" || value2 === '"' || value2 === "'"
              ? (lastLine = value2)
              : "([{".includes(value2)
                ? (depth += 1)
                : ")]}".includes(value2) && (depth = Math.max(0, depth - 1));
        }
      }
      (lastLine === '"' || lastLine === "'") && (lastLine = "");
      accepting = lastLine === "" && depth === 0 && /[);}]\s*$/.test(value);
    }
    return (
      statements +
      (lastLine !== "" ||
      depth > 0 ||
      !accepting ||
      FAST_EDIT_REPLY_PREFIX_PATTERN.test(partialLine)
        ? (inCode && BARE_FAST_EDIT_SELECTOR_PATTERN.test(partialLine)
            ? "."
            : "") + partialLine
        : "")
    );
  }
  function parseFastEditReplyChunk(
    reply?: Dynamic,
    complete?: Dynamic,
  ): Dynamic {
    let endOffset: Dynamic = complete
        ? reply.length
        : reply.lastIndexOf(`
`) + 1,
      partialLine: Dynamic = reply.slice(endOffset);
    return extractFastEditReplyStatements(
      stripReplyInlineBackticks(
        stripReplyCodeFences(reply.slice(0, endOffset)),
      ),
      /^\s*`/.test(partialLine) ? "" : partialLine,
    );
  }
  async function applyFastEditRequest(
    context?: Dynamic,
    request?: Dynamic,
  ): Promise<Dynamic> {
    let result: Dynamic = {
        calls: 0,
        skipped: 0,
        reads: false,
        conflicts: 0,
        refusedAdd: false,
        fixes: [],
        refused: null,
        partly: false,
        applied: false,
        changed: new Set(),
        added: new Set(),
        removed: new Set(),
        named: null,
      },
      finish: Dynamic = (
        input?: Dynamic,
        options: Dynamic = "",
        context2: Dynamic = "",
      ): Dynamic => ({
        outcome: input,
        code: options,
        message: context2,
        calls: result.calls,
        made: summarizeFastEditAppliedChanges(result),
      });
    if (context.host().readOnly)
      return finish(
        "failed",
        "read_only",
        runtime.FAST_EDIT_ERROR_MESSAGES.read_only,
      );
    let previousBusyFile: Dynamic = context.session.busy;
    if (previousBusyFile !== null && context.held !== true)
      return finish("failed", "busy", runtime.FAST_EDIT_ERROR_MESSAGES.busy);
    let target: Dynamic = resolveFastEditFileTarget(
      context,
      context
        .host()
        .canvas.boards()
        .map((input?: Dynamic): Dynamic => input.file),
    );
    if (target === null)
      return finish(
        "failed",
        "no_artboards",
        runtime.FAST_EDIT_ERROR_MESSAGES.no_artboards,
      );
    let draftEmitters: Dynamic = new Map();
    context.session.busy = target.file;
    result.named = context.session.named;
    context.session.named = null;
    try {
      if (context.sandbox.available !== undefined) {
        let value2: Dynamic = await Promise.race([
          context.sandbox.available,
          (0, runtime.waitForFastEditAbort)(request.signal),
        ]);
        if (value2 === "stopped") return finish("stopped", "cancelled");
        if (!value2)
          return finish(
            "failed",
            "not_loaded",
            runtime.FAST_EDIT_ERROR_MESSAGES.not_loaded,
          );
      }
      let value: Dynamic = target;
      for (;;) {
        let value2: Dynamic = await runFastEditSamplingRound(
          context,
          request,
          value,
          result,
          draftEmitters,
        );
        "done" in value2 &&
          context.comment === undefined &&
          (0, runtime.finishFastEditJournalTurn)(
            context.session,
            result.applied
              ? value2.done.unsaved !== undefined
                ? "unconfirmed"
                : "done"
              : value2.done.outcome === "stopped"
                ? null
                : "nothing",
          );
        if ("done" in value2)
          return {
            ...value2.done,
            file: value.file,
          };
        value = value2.again;
      }
    } finally {
      for (let value of draftEmitters.values() as Dynamic) value.end();
      runtime.draftHtmlPreviewStore.clear();
      runtime.draftDocumentPreviewStore.clear();
      context.session.othersChanged.clear();
      context.session.busy = previousBusyFile;
    }
  }
  async function runFastEditSamplingRound(
    context?: Dynamic,
    request?: Dynamic,
    target?: Dynamic,
    result?: Dynamic,
    draftEmitters?: Dynamic,
  ): Promise<Dynamic> {
    let sleep: Dynamic =
        context.sleep ??
        ((input?: Dynamic): Dynamic =>
          new Promise(
            (input2?: Dynamic): Dynamic => setTimeout(input2, input),
          )),
      targetFile: Dynamic = target.file,
      firstCall: Dynamic = result.calls === 0,
      finish: Dynamic = (
        input?: Dynamic,
        options: Dynamic = "",
        context2: Dynamic = "",
      ): Dynamic => ({
        done: {
          outcome: input,
          code: options,
          message: context2,
          calls: result.calls,
          skipped: result.skipped,
          made: summarizeFastEditAppliedChanges(result),
        },
      }),
      fail: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        throw {
          code: input,
          message:
            runtime.FAST_EDIT_ERROR_MESSAGES[input] ??
            runtime.FAST_EDIT_ERROR_MESSAGES.upstream_error,
          ...(options !== undefined
            ? {
                why: options,
              }
            : {}),
        };
      },
      host: Dynamic = context.host(),
      canvas: Dynamic = host.canvas,
      handles: Dynamic = host.handlesRef.current ?? new Map(),
      sandbox: Dynamic,
      timeout: Dynamic,
      writeScheduler: Dynamic = (0, runtime.createFastEditWriteScheduler)({
        now: (): Dynamic => performance.now(),
        schedule: (input?: Dynamic, options?: Dynamic): Dynamic => {
          let value5: Dynamic = setTimeout(input, options);
          return (): Dynamic => {
            clearTimeout(value5);
          };
        },
      }),
      onAbort: Dynamic = (): Dynamic => {},
      unsubscribe: Dynamic = (): Dynamic => {},
      disposed: Dynamic = false,
      cleanup: Dynamic = (): Dynamic => {
        disposed = true;
        unsubscribe();
        request.signal.removeEventListener("abort", onAbort);
        sandbox?.destroy();
        timeout !== undefined && clearTimeout(timeout);
        writeScheduler.clear();
        runtime.draftHtmlPreviewStore.clear();
        runtime.draftDocumentPreviewStore.clear();
      },
      gateReason: Dynamic = "",
      refuseGate: Dynamic = (input?: Dynamic): Dynamic => {
        throw (
          (gateReason = input),
          {
            code: "gate",
          }
        );
      },
      flag: Dynamic = false,
      flag2: Dynamic = false,
      value: Dynamic = null,
      index: Dynamic = 0,
      value2: Dynamic = null,
      flag3: Dynamic = true,
      text: Dynamic = "",
      flag4: Dynamic = false,
      index2: Dynamic = 0,
      templates: Dynamic = new Map(),
      pendingHtml: Dynamic = [],
      errors: Dynamic = [],
      allowedFiles: Dynamic = new Set([targetFile]),
      artboardsById: Dynamic = new Map(),
      fileIds: Dynamic = (0, runtime.createFastEditFileIds)([]),
      text2: Dynamic = "",
      value3: Dynamic = null,
      items: Dynamic = [],
      value4: Dynamic = -1,
      callback: Dynamic = (input?: Dynamic): Dynamic => input;
    try {
      host.readOnly && fail("read_only");
      let value5: Dynamic = targetFile === "",
        entry: Dynamic = handles.get(targetFile);
      if (entry === undefined && !value5) return fail("gone");
      (firstCall || target.retargeted === true) &&
        context.holds(targetFile) &&
        fail("busy_other");
      let callback2: Dynamic = (): Dynamic =>
        entry !== undefined &&
        context.comment?.pin === undefined &&
        entry.webviewRef.current !== null &&
        !entry.isReady();
      for (
        let index12: Dynamic = 0;
        index12 < 50 && callback2() && !request.signal.aborted;
        index12++
      )
        await sleep(120);
      callback2() && fail("not_ready");
      let value6: Dynamic = canvas.boards(),
        value7: Dynamic =
          context.comment?.pin === undefined
            ? undefined
            : {
                x: Math.round(context.comment.pin.x),
                y: Math.round(context.comment.pin.y),
                w: 0,
                h: 0,
              },
        value8: Dynamic =
          context.comment?.pin === undefined
            ? undefined
            : value6.some(
                  (input?: Dynamic): Dynamic => input.file === targetFile,
                )
              ? (0, runtime.resolveCommentPinPosition)(
                  context.comment.pin,
                  value6,
                  targetFile,
                )
              : value5
                ? {
                    x: value7.x,
                    y: value7.y,
                    atPin: true,
                  }
                : undefined,
        callback3: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
          let value69: Dynamic = (context.comment?.between ?? [])
              .flatMap(
                (input2?: Dynamic): Dynamic =>
                  value6.find(
                    (input3?: Dynamic): Dynamic => input3.file === input2.file,
                  ) ?? [],
              )
              .find(
                (input2?: Dynamic): Dynamic =>
                  input2.w === input && input2.h === options,
              ),
            value70: Dynamic =
              value8 === undefined || value69 === undefined
                ? null
                : (0, runtime.findFreeSpotAfterRow)(
                    (0, runtime.groupArtboardsIntoRows)(
                      value6.map(
                        (input2?: Dynamic): Dynamic => ({
                          id: input2.file,
                          ...(0, runtime.artboardRectangle)(input2),
                        }),
                      ),
                    ).find(
                      (input2?: Dynamic): Dynamic =>
                        input2.some(
                          (input3?: Dynamic): Dynamic =>
                            input3.id === value69.file,
                        ),
                    ),
                    value6.map(runtime.artboardRectangle),
                  );
          return value70 !== null
            ? {
                x: Math.round(value70.x),
                y: Math.round(value70.y),
              }
            : value8 === undefined
              ? undefined
              : {
                  x: value8.x,
                  y: value8.y,
                };
        };
      !value5 &&
        !value6.some((input?: Dynamic): Dynamic => input.file === targetFile) &&
        fail("gone");
      let value9: Dynamic = value6.map(
          (input?: Dynamic): Dynamic => input.file,
        ),
        value10: Dynamic =
          value9.length <= runtime.MAX_FAST_EDIT_FILES
            ? value9
            : [
                ...value9
                  .filter((input?: Dynamic): Dynamic => input !== targetFile)
                  .slice(0, runtime.MAX_FAST_EDIT_FILES - 1),
                targetFile,
              ].sort(
                (input?: Dynamic, options?: Dynamic): Dynamic =>
                  value9.indexOf(input) - value9.indexOf(options),
              );
      fileIds = (0, runtime.createFastEditFileIds)(value10);
      artboardsById = new Map();
      let entries: Dynamic = new Map(
          value6.map((input?: Dynamic): Dynamic => [input.file, input]),
        ),
        callback4: Dynamic = (input?: Dynamic): Dynamic =>
          (0, runtime.distanceBetweenArtboards)(
            entries.get(input),
            entries.get(targetFile) ?? value7 ?? entries.get(input),
          ),
        index3: Dynamic = 0;
      for (let value69 of value10
        .filter((input?: Dynamic): Dynamic => handles.has(input))
        .sort(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            callback4(input) - callback4(options),
        ) as Dynamic) {
        if (index3 > runtime.MAX_FAST_EDIT_BOX_CHARS) break;
        handles.get(value69).hasPendingEdits() &&
          (await (0, runtime.withFastEditTimeout)(
            handles
              .get(value69)
              .flushPending()
              .catch((): Dynamic => {}),
            runtime.FAST_EDIT_SANDBOX_START_TIMEOUT_MS,
          ));
        let value70: Dynamic = await (0, runtime.withFastEditTimeout)(
          handles
            .get(value69)
            .askTemplate()
            .catch((): Dynamic => null),
          2500,
        );
        if (
          typeof value70 == "string" &&
          value70.length <= runtime.MAX_FAST_EDIT_SECTION_CHARS
        ) {
          artboardsById.set(value69, value70);
          index3 += value70.length;
        } else if (typeof value70 == "string" && value69 === targetFile)
          return fail("prompt_too_large");
      }
      artboardsById = new Map(
        value10.flatMap(
          (input?: Dynamic): Dynamic =>
            artboardsById.has(input) ? [[input, artboardsById.get(input)]] : [],
        ),
      );
      let value11: Dynamic = value5 ? "" : artboardsById.get(targetFile);
      if (value11 === undefined) return fail("not_ready");
      let items2: Dynamic = [...artboardsById.keys()],
        values: Dynamic = new Set(
          value10.flatMap((input?: Dynamic): Dynamic => {
            try {
              return handles.get(input)?.pageFonts() ?? [];
            } catch {
              return [];
            }
          }),
        ),
        entries2: Dynamic = new Map(
          items2.map(
            (input?: Dynamic): Dynamic => [
              input,
              (0, runtime.readPageStylesFromSheet)(
                artboardsById.get(input),
                values,
              ),
            ],
          ),
        ),
        callback5: Dynamic = (input?: Dynamic): Dynamic =>
          (0, runtime.serializeFastEditArtboard)(
            fileIds.idOf.get(input),
            entries.get(input),
            (0, runtime.hasPageStylesheet)(artboardsById.get(input))
              ? (0, runtime.serializePageStyleAttributes)(
                  entries2.get(input) ?? {},
                )
              : "",
          ) +
          (0, runtime.encodeCamelCaseAttributes)(
            (0, runtime.stripHelmetMarkup)(artboardsById.get(input)),
          ) +
          "</section>",
        entries3: Dynamic = new Map(
          items2.map(
            (input?: Dynamic): Dynamic => [input, callback5(input).length],
          ),
        );
      if ((entries3.get(targetFile) ?? 0) > runtime.MAX_FAST_EDIT_SECTION_CHARS)
        return fail("prompt_too_large");
      let value12: Dynamic = entries3.get(targetFile) ?? 0;
      for (let value69 of items2
        .filter((input?: Dynamic): Dynamic => input !== targetFile)
        .sort(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            callback4(input) - callback4(options),
        ) as Dynamic) {
        let entry4: Dynamic = entries3.get(value69);
        entry4 <= runtime.MAX_FAST_EDIT_SECTION_CHARS &&
        value12 + entry4 <= runtime.MAX_FAST_EDIT_BOX_CHARS
          ? (value12 += entry4)
          : artboardsById.delete(value69);
      }
      let items3: Dynamic = [...artboardsById.keys()],
        value13: Dynamic = (0, runtime.collectOwnedElementIds)([
          ...artboardsById.values(),
        ]),
        value14: Dynamic =
          context.comment === undefined
            ? target.by === "selected"
              ? undefined
              : [context.session.lastTouched, ...context.inView(items3)].find(
                  (input?: Dynamic): Dynamic =>
                    input !== targetFile && artboardsById.has(input),
                )
            : context.second !== undefined &&
                context.second !== targetFile &&
                artboardsById.has(context.second)
              ? context.second
              : undefined;
      (0, runtime.collectJournalChanges)(
        context.session,
        items3.map(
          (input?: Dynamic): Dynamic => ({
            file: input,
            now: callback5(input),
            other: context.session.othersChanged.has(input),
          }),
        ),
        (input?: Dynamic): Dynamic =>
          context.host().fileText(input) !== undefined,
      );
      let index4: Dynamic = 0,
        index5: Dynamic = 0,
        index6: Dynamic = 0,
        index7: Dynamic = 0,
        items4: Dynamic = [],
        flag5: Dynamic = false,
        value15: Dynamic = null,
        value16: Dynamic,
        value17: Dynamic,
        promise: Dynamic = new Promise((input?: Dynamic): Dynamic => {
          value16 = input;
        }),
        entries4: Dynamic = new Map(),
        entries5: Dynamic = new Map(),
        index8: Dynamic = 0,
        index9: Dynamic = 0,
        callback6: Dynamic = (
          input?: Dynamic,
          options?: Dynamic,
          items8?: Dynamic,
        ): Dynamic => {
          index8 += items8.length - (input.get(options)?.length ?? 0);
          input.set(options, items8);
          index8 > runtime.MAX_FAST_EDIT_FRAME_OUTPUT_CHARS &&
            gateReason === "" &&
            ((gateReason = "too_big"),
            value17?.(),
            callback12((input2?: Dynamic): Dynamic => input2.stop()),
            value16?.());
        },
        values2: Dynamic = new Set(),
        values3: Dynamic = new Set(),
        entries6: Dynamic = new Map(),
        entries7: Dynamic = new Map(),
        entries8: Dynamic = new Map(),
        callback7: Dynamic = (input?: Dynamic): Dynamic => {
          let entry4: Dynamic = draftEmitters.get(input);
          entry4 === undefined &&
            ((entry4 = (0, runtime.createDraftEmitter)(input)),
            draftEmitters.set(input, entry4));
          return entry4;
        };
      value5 || callback7(targetFile).frame("");
      let callback8: Dynamic = (input?: Dynamic): Dynamic => {
          if (disposed || request.signal.aborted || flag4 || value !== null)
            return 0;
          let entry4: Dynamic = entries4.get(input);
          if (entry4 === undefined) return 0;
          let value69: Dynamic = (0, runtime.rehydrateFastEditHtml)(
              "",
              entry4,
              value13,
            ),
            value70: Dynamic = (0, runtime.parseFastEditArtboardSection)(
              entry4,
            ),
            value71: Dynamic =
              value69 === null || value70 === null
                ? null
                : (0, runtime.validateFastEditTemplate)("", value69);
          if (value70 === null || value71 === null || !value71.ok) {
            runtime.draftDocumentPreviewStore.drop(input);
            return entry4.length;
          }
          let value72: Dynamic = value70.w ?? 480,
            value73: Dynamic = value70.h ?? 560,
            entry5: Dynamic = entries6.get(input);
          if (
            entry5 === undefined ||
            entry5.w !== value72 ||
            entry5.h !== value73
          ) {
            let value74: Dynamic = canvas.boards(),
              value75: Dynamic = value74.find(
                (input2?: Dynamic): Dynamic => input2.file === targetFile,
              );
            if (value75 === undefined && !value5) return entry4.length;
            let value76: Dynamic =
                value75 !== undefined
                  ? (0, runtime.artboardRectangle)(value75)
                  : value7,
              items8: Dynamic = [
                ...value74.map(
                  (input2?: Dynamic): Dynamic =>
                    input2.file === targetFile
                      ? value76
                      : (0, runtime.artboardRectangle)(input2),
                ),
                ...[...entries6]
                  .filter(([input2]: Dynamic): Dynamic => input2 !== input)
                  .map(([, input2]: Dynamic): Dynamic => input2),
              ],
              value77: Dynamic =
                value70.x !== undefined &&
                value70.y !== undefined &&
                Math.min(
                  ...items8.map(
                    (input2?: Dynamic): Dynamic =>
                      (0, runtime.distanceBetweenArtboards)(
                        {
                          x: value70.x,
                          y: value70.y,
                          w: value72,
                          h: value73,
                        },
                        input2,
                      ),
                  ),
                ) > 480,
              value78: Dynamic = (0, runtime.findAvailableArtboardPosition)(
                {
                  ...(value8 !== undefined
                    ? callback3(value72, value73)
                    : value70.x !== undefined &&
                        value70.y !== undefined &&
                        !value77
                      ? {
                          x: value70.x,
                          y: value70.y,
                        }
                      : {}),
                  w: value72,
                  h: value73,
                },
                items8,
                value76,
              );
            entry5 = {
              x: value78.x,
              y: value78.y,
              w: value72,
              h: value73,
            };
            let value79: Dynamic = !entries6.has(input);
            entries6.set(input, entry5);
            if (value79 && !context.pointerDown())
              try {
                canvas.revealRect(entry5);
              } catch {}
          }
          try {
            runtime.draftDocumentPreviewStore.set(input, {
              ...entry5,
              doc: (0, runtime.buildStaticFastEditPreview)(
                value71.template,
                {},
              ),
              title: (0, runtime.sanitizeArtboardTitle)(
                value70.title ?? "",
                40,
              ),
            });
          } catch {}
          return entry4.length;
        },
        callback9: Dynamic = (input?: Dynamic): Dynamic => {
          !flag5 &&
            !disposed &&
            writeScheduler.ask("n:" + input, (): Dynamic => callback8(input));
        },
        entries9: Dynamic = new Map(),
        callback10: Dynamic = (input?: Dynamic): Dynamic => {
          if (
            disposed ||
            request.signal.aborted ||
            gateReason !== "" ||
            flag4 ||
            value !== null
          )
            return 0;
          let entry4: Dynamic = templates.get(input),
            entry5: Dynamic = artboardsById.get(input);
          if (entry4 === undefined || entry5 === undefined) return 0;
          let entry6: Dynamic = entries9.get(input);
          if (entry6 === undefined) {
            if (!entries8.has(input)) {
              let value73: Dynamic = (0, runtime.readTemplateInputDefaults)(
                  context.host().fileText(input) ?? "",
                ),
                value74: Dynamic = (
                  handles.get(input)?.renderDefaults() ?? Promise.resolve({})
                ).catch((): Dynamic => ({})),
                value75: Dynamic = Promise.race([
                  value74,
                  new Promise(
                    (input2?: Dynamic): Dynamic => setTimeout(input2, 400, {}),
                  ),
                ]).then(
                  (input2?: Dynamic): Dynamic => ({
                    ...value73,
                    ...input2,
                  }),
                );
              entries8.set(input, value75);
              value75.then((input2?: Dynamic): Dynamic => {
                entries9.set(input, input2);
                callback11(input);
              });
            }
            return 0;
          }
          let value69: Dynamic = entry4.length + entry5.length,
            value70: Dynamic = (0, runtime.rehydrateFastEditHtml)(
              entry5,
              entry4,
              value13,
            ),
            value71: Dynamic =
              value70 === null
                ? null
                : (0, runtime.validateFastEditTemplate)(
                    entry5,
                    (0, runtime.preserveHelmetMarkup)(entry5, value70),
                  );
          if (value71 === null || !value71.ok) {
            runtime.draftHtmlPreviewStore.set(input, null);
            return value69;
          }
          let entry7: Dynamic = entries7.get(input);
          if (entry7 === undefined) {
            let value73: Dynamic = (0, runtime.validateFastEditTemplate)(
              entry5,
              entry5,
            );
            entry7 = value73.ok ? value73.template : "";
            entries7.set(input, entry7);
          }
          if (value71.template === entry7) {
            runtime.draftHtmlPreviewStore.set(input, null);
            return value69;
          }
          let value72: Dynamic = (0, runtime.stripHelmetMarkup)(
            value71.template,
          );
          if (
            value72.replace(/<[^>]*>/g, "").trim() === "" &&
            !/<(?:img|svg|hr|table|button|input)\b/i.test(value72) &&
            (0, runtime.stripHelmetMarkup)(entry7)
              .replace(/<[^>]*>/g, "")
              .trim() !== ""
          )
            return value69;
          try {
            runtime.draftHtmlPreviewStore.set(
              input,
              (0, runtime.buildStaticFastEditPreview)(value71.template, entry6),
            );
          } catch {
            return value69;
          }
          callback7(input).frame(value71.template);
          return value69;
        },
        callback11: Dynamic = (input?: Dynamic): Dynamic => {
          !flag5 &&
            !disposed &&
            writeScheduler.ask("f:" + input, (): Dynamic => callback10(input));
        },
        callback12: Dynamic = (input?: Dynamic): Dynamic => {
          try {
            sandbox !== undefined && input(sandbox);
          } catch {
            flag2 = true;
            value17?.();
          }
        },
        callback13: Dynamic = (input?: Dynamic): Dynamic =>
          callback12((input2?: Dynamic): Dynamic => input2.feed(input));
      try {
        sandbox = context.sandbox.create({
          files: value10.map(
            (input?: Dynamic): Dynamic => ({
              id: fileIds.idOf.get(input),
              path: input,
              title: (0, runtime.safeArtboardTitle)(entries.get(input).title),
              html: artboardsById.has(input)
                ? callback5(input)
                : (0, runtime.serializeFastEditArtboard)(
                    fileIds.idOf.get(input),
                    entries.get(input),
                    "",
                  ) + "</section>",
            }),
          ),
          title:
            (0, runtime.sanitizeArtboardTitle)(host.canvasTitle, 300) ||
            "Canvas",
          ...(value5
            ? {}
            : {
                current: fileIds.idOf.get(targetFile),
              }),
          onHtml: (input?: Dynamic): Dynamic => {
            if (input.final === true) {
              flag5 && value16?.();
              return;
            }
            let value69: Dynamic =
              input.id === null ? undefined : fileIds.pathOf.get(input.id);
            if (!(index8 > runtime.MAX_FAST_EDIT_FRAME_OUTPUT_CHARS)) {
              if (
                value69 !== undefined &&
                !artboardsById.has(value69) &&
                input.html.length > runtime.MAX_FAST_EDIT_INPUT_LOG_CHARS
              ) {
                values2.add(value69);
                return;
              }
              value69 !== undefined
                ? (callback6(templates, value69, input.html),
                  callback11(value69))
                : input.id !== null && entries4.has(input.id)
                  ? (callback6(entries4, input.id, input.html),
                    callback9(input.id))
                  : input.id !== null &&
                    entries5.has(input.id) &&
                    callback6(entries5, input.id, input.html);
            }
          },
          onOp: (input?: Dynamic): Dynamic => {
            let value69: Dynamic = input;
            if (
              value69 !== null &&
              typeof value69 == "object" &&
              value69.op === "askClaude"
            ) {
              value === null &&
                ((value =
                  typeof value69.prompt == "string"
                    ? (0, runtime.sanitizeArtboardTitle)(value69.prompt, 1e3)
                    : ""),
                context.onStatement?.(),
                runtime.draftHtmlPreviewStore.clear(),
                runtime.draftDocumentPreviewStore.clear(),
                value17?.(),
                callback12((input2?: Dynamic): Dynamic => input2.stop()),
                value16?.());
              return;
            }
            if (value !== null) return;
            index7 += 1;
            let value70: Dynamic = (0, runtime.parseFastEditArtboardOperation)(
                input,
                fileIds.pathOf,
              ),
              value71: Dynamic =
                value70 !== null &&
                (value70.op === "add" || value70.op === "duplicate");
            value70 !== null &&
              (value71
                ? index9 <= runtime.FAST_EDIT_OPERATION_LIMITS.news
                : pendingHtml.length - index9 < runtime.MAX_FAST_EDIT_FILES) &&
              (pendingHtml.push(value70),
              value71 && (index9 += 1),
              value70.op === "duplicate" &&
                value70.newId !== undefined &&
                callback6(entries5, value70.newId, value70.html ?? ""));
            if (
              value70 !== null &&
              value70.op === "add" &&
              value70.id !== undefined &&
              !fileIds.pathOf.has(value70.id) &&
              entries4.size -
                (entries4.has(runtime.OPEN_ARTBOARD_PLACEHOLDER_ID) ? 1 : 0) <
                runtime.FAST_EDIT_OPERATION_LIMITS.news
            ) {
              let entry4: Dynamic = entries6.get(
                runtime.OPEN_ARTBOARD_PLACEHOLDER_ID,
              );
              entries4.delete(runtime.OPEN_ARTBOARD_PLACEHOLDER_ID);
              entries6.delete(runtime.OPEN_ARTBOARD_PLACEHOLDER_ID);
              runtime.draftDocumentPreviewStore.drop(
                runtime.OPEN_ARTBOARD_PLACEHOLDER_ID,
              );
              entry4 !== undefined && entries6.set(value70.id, entry4);
              callback6(entries4, value70.id, value70.html);
              callback9(value70.id);
            }
            let value72: Dynamic = input;
            value72 !== null &&
              typeof value72 == "object" &&
              value72.op === "remove" &&
              typeof value72.id == "string" &&
              entries4.has(value72.id) &&
              (entries4.delete(value72.id),
              values3.add(value72.id),
              runtime.draftDocumentPreviewStore.drop(value72.id));
          },
          onDone: (input?: Dynamic): Dynamic => {
            index2 += 1;
            items.push(input.stmt ?? "");
            input.changed.length > 0
              ? (index4 += 1)
              : value3 === null &&
                index7 === 0 &&
                input.failed !== true &&
                input.stmt !== undefined &&
                !runtime.FAST_EDIT_CONTROL_CALL_PATTERN.test(input.stmt) &&
                (((context.noMatch?.inserts ??
                  runtime.FAST_EDIT_COLLECT_READS) &&
                  runtime.FAST_EDIT_HTML_INSERTION_PATTERN.test(input.stmt) &&
                  input.stmt.includes("<")) ||
                  ((context.noMatch?.writes ??
                    runtime.FAST_EDIT_ALLOW_EMPTY_SELECTION) &&
                    runtime.FAST_EDIT_MUTATION_CALL_PATTERN.test(
                      input.stmt,
                    ))) &&
                ((value3 = input.stmt), (value4 = items.length - 1));
            index7 = 0;
            value === null && context.onStatement?.();
          },
          onPreview: (event?: Dynamic): Dynamic => {
            if (
              request.signal.aborted ||
              flag4 ||
              typeof event.html != "string" ||
              event.html.length > 2e5
            )
              return;
            if (
              event.method === "create" &&
              event.target === null &&
              /^<section\b/i.test(event.html)
            ) {
              entries4.set(runtime.OPEN_ARTBOARD_PLACEHOLDER_ID, event.html);
              callback9(runtime.OPEN_ARTBOARD_PLACEHOLDER_ID);
              return;
            }
            if (
              event.method !== "html" ||
              event.target === null ||
              typeof event.target.file != "string" ||
              event.target.id !== event.target.file
            )
              return;
            let entry4: Dynamic = fileIds.pathOf.get(event.target.file),
              value69: Dynamic =
                entry4 === undefined ? undefined : artboardsById.get(entry4);
            if (
              entry4 === undefined ||
              value69 === undefined ||
              flag5 ||
              disposed
            )
              return;
            let html: Dynamic = event.html;
            writeScheduler.ask("f:" + entry4, (): Dynamic => {
              if (disposed || request.signal.aborted || flag4 || value !== null)
                return 0;
              let value70: Dynamic = (0, runtime.validateFastEditTemplate)(
                value69,
                (0, runtime.preserveHelmetMarkup)(value69, html),
              );
              if (value70.ok)
                try {
                  runtime.draftHtmlPreviewStore.set(
                    entry4,
                    (0, runtime.buildStaticFastEditPreview)(
                      value70.template,
                      (0, runtime.readTemplateInputDefaults)(
                        context.host().fileText(entry4) ?? "",
                      ),
                    ),
                  );
                } catch {}
              return html.length + value69.length;
            });
          },
          onError: (input?: Dynamic): Dynamic => {
            let refused: Dynamic = input.refused;
            value15 === null &&
              (refused === "exists" ||
                refused === "removed" ||
                refused === "own" ||
                refused === "not_plain") &&
              (value15 = {
                code: refused,
                id:
                  typeof input.id == "string" &&
                  /^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(input.id)
                    ? input.id
                    : "",
              });
            index5 += 1;
            input.fatal === true &&
              ((flag2 = true), (text = String(input.message)), value17?.());
          },
          onLog: (input?: Dynamic): Dynamic => {
            typeof input.n == "number" &&
              items4.length < runtime.MAX_PROMPT_ARTBOARD_NEIGHBORS &&
              items4.push(
                typeof input.message == "string" ? input.message : "",
              );
          },
          onTouch: (): Dynamic => {
            index6 += 1;
          },
        });
      } catch {
        sandbox = undefined;
      }
      let value18: Dynamic = value5
          ? Promise.resolve("held")
          : (0, runtime.verifySandboxTemplateRoundTrip)(
              context.sandbox,
              (0, runtime.stripHelmetMarkup)(value11),
            ),
        value19: Dynamic =
          sandbox === undefined
            ? {
                ok: false,
              }
            : await (0, runtime.withFastEditTimeout)(
                Promise.resolve(sandbox.ready).catch(
                  (): Dynamic => ({
                    ok: false,
                  }),
                ),
                2500,
              ),
        callback14: Dynamic = (): Dynamic =>
          fail(
            context.starts !== undefined &&
              ++context.starts.lateInARow >=
                runtime.MAX_FAST_EDIT_REPAIR_ATTEMPTS
              ? "start_stuck"
              : "slow_start",
          );
      if (
        sandbox !== undefined &&
        (value19 === runtime.FAST_EDIT_TIMEOUT_SENTINEL ||
          (value19.ok === false &&
            runtime.SANDBOX_NOT_READY_MESSAGE_PATTERN.test(text)))
      )
        return callback14();
      if (
        sandbox === undefined ||
        value19 === runtime.FAST_EDIT_TIMEOUT_SENTINEL ||
        value19.ok === false
      )
        return fail("no_box");
      let value20: Dynamic = await value18;
      if (value20 === "late") return callback14();
      context.starts !== undefined && (context.starts.lateInARow = 0);
      (value20 === "reshaped" ||
        !(0, runtime.validateFastEditTemplate)(value11, value11).ok) &&
        fail("box_cannot_hold");
      request.signal.aborted && fail("cancelled");
      let value21: Dynamic = fileIds.idOf.get(targetFile) ?? "",
        entry2: Dynamic = fileIds.idOf.get(
          value5 ? (items3[0] ?? value10[0] ?? "") : targetFile,
        ),
        value22: Dynamic =
          entry2 === undefined
            ? {
                html: "",
                prefix: "k",
              }
            : await (0, runtime.withFastEditTimeout)(
                sandbox.view(entry2).catch((): Dynamic => null),
                2e3,
              ),
        value23: Dynamic =
          value5 &&
          value22 !== runtime.FAST_EDIT_TIMEOUT_SENTINEL &&
          value22 !== null
            ? {
                ...value22,
                html: "",
              }
            : value22;
      if (
        value23 === runtime.FAST_EDIT_TIMEOUT_SENTINEL ||
        value23 === null ||
        typeof value23.html != "string" ||
        !/^[a-z]{1,8}$/.test(value23.prefix)
      )
        return fail("no_box");
      let value24: Dynamic =
          value14 === undefined
            ? null
            : await (0, runtime.withFastEditTimeout)(
                sandbox
                  .view(fileIds.idOf.get(value14))
                  .catch((): Dynamic => null),
                2e3,
              ),
        value25: Dynamic =
          value24 !== runtime.FAST_EDIT_TIMEOUT_SENTINEL &&
          value24 !== null &&
          typeof value24.html == "string"
            ? {
                id: fileIds.idOf.get(value14),
                html: (0, runtime.truncateLargeDataUris)(
                  (0, runtime.removeHelmetHandleIds)(
                    value24.html,
                    value23.prefix,
                  ),
                ),
              }
            : undefined,
        value26: Dynamic =
          value25 !== undefined &&
          value25.html.length <= runtime.MAX_INLINE_DATA_URI_CHARS &&
          context.contextOnly !== true
            ? value14
            : undefined,
        entries10: Dynamic = new Map(
          items3.map((input?: Dynamic): Dynamic => {
            let value69: Dynamic = (0, runtime.truncateLargeDataUris)(
              callback5(input),
            );
            return [
              input,
              value69.length + 12 * (value69.match(/<[a-z]/gi)?.length ?? 0),
            ];
          }),
        ),
        callback15: Dynamic = (input?: Dynamic): Dynamic =>
          entries10.get(input),
        value27: Dynamic =
          runtime.MAX_DATA_URI_SCAN_CHARS -
          Math.min(
            entries10.get(targetFile) ?? 0,
            context.comment !== undefined
              ? 24e3
              : runtime.MAX_DATA_URI_SCAN_CHARS,
          ) -
          (value25 === undefined
            ? 0
            : Math.min(value25.html.length, runtime.MAX_INLINE_DATA_URI_CHARS)),
        value28: Dynamic = (
          context.comment !== undefined && context.comment.pin === undefined
            ? []
            : [
                ...new Set([
                  context.session.lastTouched,
                  ...context.inView(items3),
                  ...items3,
                ]),
              ]
        ).filter(
          (input?: Dynamic): Dynamic =>
            entries10.has(input) &&
            input !== targetFile &&
            input !== value14 &&
            callback15(input) <= value27 &&
            (value27 -= callback15(input)) >= 0,
        ),
        value29: Dynamic = (
          await Promise.all(
            value28.map(
              (input?: Dynamic): Dynamic =>
                (0, runtime.withFastEditTimeout)(
                  sandbox
                    .view(fileIds.idOf.get(input))
                    .catch((): Dynamic => null),
                  2e3,
                ),
            ),
          )
        ).flatMap(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            input !== runtime.FAST_EDIT_TIMEOUT_SENTINEL &&
            input !== null &&
            typeof input.html == "string"
              ? [
                  {
                    id: fileIds.idOf.get(value28[options]),
                    html: (0, runtime.removeHelmetHandleIds)(
                      input.html,
                      value23.prefix,
                    ),
                  },
                ]
              : [],
        ),
        entries11: Dynamic = new Map([
          ...(value5 ? [] : [[targetFile, value23.html]]),
          ...(value24 !== runtime.FAST_EDIT_TIMEOUT_SENTINEL &&
          value24 !== null &&
          typeof value24.html == "string"
            ? [[value14, value24.html]]
            : []),
          ...value29.map(
            (input?: Dynamic): Dynamic => [
              fileIds.pathOf.get(input.id) ?? "",
              input.html,
            ],
          ),
        ]),
        entries12: Dynamic = new Map(),
        callback16: Dynamic = (input?: Dynamic): Dynamic => {
          let value69: Dynamic = Array.from(
            (0, runtime.parseTargetTemplate)(input).querySelectorAll("*"),
          );
          return {
            ids: value69.map(
              (element?: Dynamic): Dynamic => element.getAttribute("id") ?? "",
            ),
            shape: value69
              .map(
                (input2?: Dynamic): Dynamic =>
                  input2.localName + String(input2.children.length),
              )
              .join(" "),
          };
        },
        entries13: Dynamic = new Map(),
        callback17: Dynamic = (input?: Dynamic): Dynamic => {
          let entry4: Dynamic = entries13.get(input);
          if (entry4 === undefined) {
            let entry5: Dynamic = entries11.get(input),
              entry6: Dynamic = result.named.states.get(input),
              value69: Dynamic =
                entry5 === undefined ||
                entry6 === undefined ||
                entry6.text !== callback5(input)
                  ? null
                  : callback16(entry5);
            entries13.set(
              input,
              (entry4 =
                value69 === null || value69.shape !== entry6.shape
                  ? null
                  : value69.ids),
            );
          }
          return entry4;
        },
        value30: Dynamic = (result.named?.at ?? []).flatMap(
          (input?: Dynamic): Dynamic => {
            let value69: Dynamic = callback17(input.file);
            if (value69 === null) return [];
            let value70: Dynamic =
              input.at < 0 ? null : (value69[input.at] ?? "");
            return value70 === input.was
              ? []
              : [
                  {
                    was: input.was,
                    now: value70,
                    on: fileIds.idOf.get(input.file) ?? "",
                  },
                ];
          },
        ),
        entry3: Dynamic = entries.get(targetFile),
        value31: Dynamic =
          context.comment?.path === undefined || context.drawnAt === undefined
            ? null
            : await (0, runtime.withFastEditTimeout)(
                context
                  .drawnAt(
                    targetFile,
                    context.comment.path,
                    context.comment.tid ?? null,
                  )
                  .catch((): Dynamic => null),
                2e3,
              ),
        value32: Dynamic =
          value31 === runtime.FAST_EDIT_TIMEOUT_SENTINEL ? null : value31;
      value32?.imported === true && fail("in_import");
      if (
        context.comment?.fp === true &&
        context.comment.path !== undefined &&
        value32 !== null &&
        !value32.atPath
      ) {
        let value69: Dynamic =
          context.rectsOf === undefined
            ? null
            : await (0, runtime.withFastEditTimeout)(
                context
                  .rectsOf(targetFile, [
                    {
                      path: context.comment.path,
                      tid: null,
                    },
                  ])
                  .catch((): Dynamic => null),
                2e3,
              );
        (Array.isArray(value69) &&
          value69.length === 1 &&
          value69[0] === null) ||
          fail("not_named");
      }
      let value33: Dynamic =
        context.comment?.path === undefined
          ? null
          : (0, runtime.resolveClickedElementTarget)(
              context.comment.path,
              value32,
              value11,
              value23.html,
              value23.prefix,
            );
      context.comment?.path !== undefined &&
        value33 === null &&
        value32?.hollow !== true &&
        fail("not_named");
      let value34: Dynamic =
          value33 === null ||
          value33.hollow ||
          value32 === null ||
          (!value32.atPath && value32.all === "") ||
          context.comment?.click.x === undefined ||
          context.comment.click.y === undefined ||
          runtime.STRUCTURAL_LEAF_ELEMENT_TAGS.has(value33.tag)
            ? null
            : (0, runtime.findNearestProbeRectangle)(
                value32.words,
                context.comment.click.x,
                context.comment.click.y,
              ),
        value35: Dynamic = value33 !== null && value33.inList,
        value36: Dynamic =
          context.comment !== undefined || target.by !== "selected"
            ? []
            : (host.selectedElements?.find(
                (input?: Dynamic): Dynamic => input.file === targetFile,
              )?.tids ?? []),
        value37: Dynamic = (0, runtime.resolveTemplateHandleIds)(
          [...new Set(value36)],
          value11,
          value23.html,
          value23.prefix,
        ).flatMap((input?: Dynamic): Dynamic => input ?? []),
        value38: Dynamic = value37.slice(0, runtime.MAX_PROMPT_LIST_ITEMS),
        value39: Dynamic =
          value33 === null ||
          value33.hollow ||
          context.layoutOf === undefined ||
          value32?.atPath === false
            ? null
            : await (0, runtime.withFastEditTimeout)(
                context
                  .layoutOf(targetFile, context.comment.path)
                  .catch((): Dynamic => null),
                2e3,
              );
      result.applied ||
        (context.session.turn = {
          file: targetFile,
          before: value5 ? "" : callback5(targetFile),
        });
      let callback18: Dynamic = (input?: Dynamic): Dynamic =>
          fileIds.idOf.get(input) ?? input.replace(/\.dc\.html$/, ""),
        value40: Dynamic = (0, runtime.recordFastEditReadResult)(
          context.session.journal,
          {
            file: targetFile,
            html: value23.html,
            prefix: value23.prefix,
          },
          callback18,
        ),
        value41: Dynamic =
          value14 === context.session.lastTouched
            ? value25
            : value29.find(
                (input?: Dynamic): Dynamic =>
                  input.id === fileIds.idOf.get(context.session.lastTouched),
              ),
        value42: Dynamic =
          value41 !== undefined
            ? (0, runtime.recordFastEditReadResult)(
                context.session.journal,
                {
                  file: context.session.lastTouched,
                  html: value41.html,
                  prefix: value23.prefix,
                },
                callback18,
              ).last
            : value40.last,
        state: Dynamic = {
          lastMade:
            context.session.lastTouched !== "" &&
            fileIds.idOf.has(context.session.lastTouched)
              ? fileIds.idOf.get(context.session.lastTouched)
              : null,
          ...(value42 !== null &&
          value42.file === context.session.lastTouched &&
          value42.handle !== ""
            ? {
                lastElement: value42.handle,
              }
            : {}),
        },
        history: Dynamic = context.session.history,
        value43: Dynamic = (0, runtime.beginHistoryTurn)(history),
        callback19: Dynamic = (input?: Dynamic): Dynamic => {
          history.turns.push({
            role: "user",
            id: value43,
            content: "",
          });
          let value69: Dynamic = (0, runtime.trimHistoryTurns)(
            history.turns,
            input,
          );
          history.turns.pop();
          return value69;
        },
        value44: Dynamic = callback19(history.chars),
        state2: Dynamic = {
          history: history.turns,
          turn: value43,
          historyChars: history.chars,
          renamed: value30,
          rules: context.rules.split("{{PREFIX}}").join(value23.prefix),
          ...(context.addRules !== undefined &&
          (context.comment === undefined || context.comment.pin !== undefined)
            ? {
                extraRules: context.addRules
                  .split("{{PREFIX}}")
                  .join(value23.prefix),
              }
            : {}),
          ...(context.contextOnly === true
            ? {
                contextOnly: true,
              }
            : {}),
          shown: {
            id: value21,
            html: (0, runtime.removeHelmetHandleIds)(
              value23.html,
              value23.prefix,
            ),
            w: entry3?.w ?? 0,
            h: entry3?.h ?? 0,
          },
          click:
            context.comment === undefined
              ? {}
              : value33 !== null && !value33.hollow
                ? {
                    ...context.comment.click,
                    element: {
                      id: value33.id,
                      tag: value33.tag,
                      text: value33.text,
                      ...(value35
                        ? {
                            inList: true,
                          }
                        : {}),
                      ...((
                        value33.own === ""
                          ? (0, runtime.containsOnlyTemplateInterpolation)(
                              value33.text,
                            )
                          : value33.own.includes("{{")
                      )
                        ? {
                            fromSetting: true,
                          }
                        : {}),
                      ...(value33.drawing !== null
                        ? {
                            drawing: value33.drawing,
                          }
                        : {}),
                      ...(value32 !== null && value32.all !== ""
                        ? {
                            drawnAs: value32.all,
                          }
                        : {}),
                      ...(value32 !== null
                        ? {
                            look:
                              value32.words.length > 0
                                ? value32.look
                                : (0, runtime.pickTargetAppearanceContext)(
                                    value32.look,
                                  ),
                          }
                        : {}),
                    },
                    parent: value33.parent,
                    ...(value39 !== null &&
                    value39 !== runtime.FAST_EDIT_TIMEOUT_SENTINEL
                      ? {
                          layout: value39,
                        }
                      : {}),
                    ...(value34 !== null
                      ? {
                          blank: value34,
                          ...(0, runtime.pickTargetSiblingContext)(
                            await (0, runtime.resolveFastEditClickTarget)(
                              context,
                              targetFile,
                              context.comment.click,
                              value23.html,
                              value23.prefix,
                            ),
                          ),
                        }
                      : {}),
                  }
                : context.comment.click.ground === true ||
                    context.comment.path !== undefined
                  ? {
                      ...context.comment.click,
                      ground: true,
                      ...(value35
                        ? {
                            ...(0, runtime.pickTargetSiblingContext)(
                              await (0, runtime.resolveFastEditClickTarget)(
                                context,
                                targetFile,
                                context.comment.click,
                                value23.html,
                                value23.prefix,
                              ),
                            ),
                            inside: value33.id,
                            insideList: true,
                          }
                        : await (0, runtime.resolveFastEditClickTarget)(
                            context,
                            targetFile,
                            context.comment.click,
                            value23.html,
                            value23.prefix,
                          )),
                    }
                  : {
                      ...context.comment.click,
                      ...(context.comment.between !== undefined
                        ? {
                            between: context.comment.between.map(
                              (input?: Dynamic): Dynamic => ({
                                id: fileIds.idOf.get(input.file) ?? "",
                                px: input.px,
                                side: input.side,
                              }),
                            ),
                          }
                        : {}),
                      ...(value8 !== undefined
                        ? {
                            newAt: value8,
                          }
                        : {}),
                    },
          comment: request.words,
          maxBytes: context.maxBytes,
          journal: value40.text,
          writing: items3
            .filter(
              (input?: Dynamic): Dynamic =>
                input !== targetFile && context.holds(input),
            )
            .map((input?: Dynamic): Dynamic => fileIds.idOf.get(input)),
          design: ((input?: Dynamic): Dynamic =>
            value10.map((input2?: Dynamic): Dynamic => {
              let entry4: Dynamic = entries.get(input2),
                value69: Dynamic = artboardsById.has(input2)
                  ? (0, runtime.summarizeArtboardText)(callback5(input2))
                  : "";
              return {
                id: fileIds.idOf.get(input2),
                w: entry4.w,
                h: entry4.h,
                words: value69,
                ...(artboardsById.has(input2)
                  ? value69 === "" &&
                    (0, runtime.isEmptyStructuralTemplate)(callback5(input2))
                    ? {
                        empty: true,
                      }
                    : {}
                  : {
                      tooLarge: true,
                    }),
                x: entry4.x,
                y: entry4.y,
                title: (0, runtime.safeArtboardTitle)(entry4.title),
                far: input.get(input2),
              };
            }))(
            new Map(
              [...value10]
                .sort(
                  (input?: Dynamic, options?: Dynamic): Dynamic =>
                    Number(artboardsById.has(options)) -
                      Number(artboardsById.has(input)) ||
                    callback4(input) - callback4(options),
                )
                .map(
                  (input?: Dynamic, options?: Dynamic): Dynamic => [
                    input,
                    options,
                  ],
                ),
            ),
          ),
          inView: context
            .inView(items3)
            .slice(0, 12)
            .map((input?: Dynamic): Dynamic => fileIds.idOf.get(input)),
          ...(target.report !== undefined
            ? {
                note: target.report.split("{{PREFIX}}").join(value23.prefix),
                ...(target.line !== undefined
                  ? {
                      noteLine: target.line,
                    }
                  : {}),
              }
            : {}),
          ...(value25 !== undefined
            ? {
                second: value25,
              }
            : {}),
          ...(value29.length > 0
            ? {
                more: value29,
              }
            : {}),
          ...(target.logs !== undefined
            ? {
                logs: target.logs,
              }
            : {}),
          ...(context.comment !== undefined
            ? state
            : {
                typed: {
                  by: target.by,
                  pictures: request.images.length,
                  ...state,
                  elements: value38.map(
                    (input?: Dynamic): Dynamic => ({
                      id: input.id,
                      tag: input.tag,
                      text: input.text,
                      drawing: input.drawing,
                      ...(input.inList
                        ? {
                            inList: true,
                          }
                        : {}),
                    }),
                  ),
                  moreElements: value37.length - value38.length,
                  othersChanged: [...context.session.othersChanged]
                    .map(
                      (input?: Dynamic): Dynamic =>
                        fileIds.idOf.get(input) ?? "",
                    )
                    .filter((input?: Dynamic): Dynamic => input !== "")
                    .slice(0, 6),
                  places:
                    target.by !== "selected"
                      ? (0, runtime.describeFreeCanvasSpots)(
                          value10.map(
                            (input?: Dynamic): Dynamic => ({
                              id: fileIds.idOf.get(input),
                              ...(0, runtime.artboardRectangle)(
                                entries.get(input),
                              ),
                            }),
                          ),
                          value6.map(runtime.artboardRectangle),
                          context
                            .inView(items3)
                            .slice(0, 12)
                            .map(
                              (input?: Dynamic): Dynamic =>
                                fileIds.idOf.get(input),
                            ),
                        )
                      : (0, runtime.findAdjacentArtboardSpaces)(
                          value6
                            .filter(
                              (input?: Dynamic): Dynamic =>
                                input.file !== targetFile,
                            )
                            .map(runtime.artboardRectangle),
                          (0, runtime.artboardRectangle)(entry3),
                        ).line,
                },
              }),
        },
        callback20: Dynamic = (): Dynamic =>
          (0, runtime.buildFastEditPrompt)({
            ...state2,
            told: [
              ...history.told,
              ...(value44.length > 0
                ? [(0, runtime.describeAutomaticallyDroppedTurns)(value44)]
                : []),
            ],
          }),
        value45: Dynamic = callback20();
      for (
        !value45.ok &&
        history.told.length > 0 &&
        ((0, runtime.resetHistoryNotes)(history), (value45 = callback20()));
        !value45.ok;

      ) {
        let value69: Dynamic = callback19(
          (0, runtime.countHistoryCharacters)(history.turns) - 1,
        );
        if (value69.length === 0) break;
        value44.push(...value69);
        value45 = callback20();
      }
      value44.length > 0 &&
        (history.told.push(
          (0, runtime.describeAutomaticallyDroppedTurns)(value44),
        ),
        history.trace.blind.push(value44));
      value45.ok ||
        ((0, runtime.resetHistoryNotes)(history), fail("prompt_too_large"));
      (0, runtime.appendHistoryUserTurn)(history, value43, value45.kept);
      context.session.turn !== null && (context.session.turn.open = true);
      request.signal.aborted && fail("cancelled");
      if (
        firstCall &&
        target.retargeted !== true &&
        context.target === undefined
      ) {
        let value69: Dynamic = canvas
            .boards()
            .map((input?: Dynamic): Dynamic => input.file),
          value70: Dynamic = selectedFastEditFile(context.host(), value69);
        if (
          value70 !== undefined &&
          value70 !== targetFile &&
          handles.has(value70)
        ) {
          cleanup();
          for (let value71 of draftEmitters.values() as Dynamic) value71.end();
          draftEmitters.clear();
          context.session.busy = value70;
          return {
            again: {
              file: value70,
              by: "selected",
              retargeted: true,
            },
          };
        }
      }
      result.calls >= (context.maxCalls ?? runtime.MAX_FAST_EDIT_CALLS) &&
        fail("call_cap");
      result.calls += 1;
      let value46: Dynamic = -1,
        index10: Dynamic = 0,
        index11: Dynamic = 0,
        value47: Dynamic = (0, runtime.nextHandleSequence)(
          value45.files,
          value23.prefix,
        ),
        callback21: Dynamic = (
          input?: Dynamic,
          options?: Dynamic,
          context2?: Dynamic,
        ): Dynamic =>
          context.feedAsWritten === true
            ? input
            : (0, runtime.adoptHandleIds)(
                (0, runtime.isIncompleteInsertionStatement)(
                  (0, runtime.rewriteContainerAppendStatements)(
                    input,
                    options,
                    context2,
                  ),
                  options,
                ),
                value23.prefix,
                value47,
                options,
                value13,
              );
      callback = (input?: Dynamic): Dynamic => {
        let rest: Dynamic = (0, runtime.extractForgetStatements)(
            history.said,
            true,
          ).rest,
          callback26: Dynamic = (input2?: Dynamic): Dynamic =>
            input2.split(/[\n\0]/),
          value69: Dynamic = callback26(callback21(rest, true, "\0")),
          value70: Dynamic = callback26(
            context.feedAsWritten === true
              ? rest
              : (0, runtime.rewriteContainerAppendStatements)(rest, true, "\0"),
          ),
          value71: Dynamic = -1,
          index12: Dynamic = 0;
        for (let value72 of items.slice(0, value4 + 1) as Dynamic) {
          let value73: Dynamic = value72
            .split(
              `
`,
              1,
            )[0]
            .trim();
          value71 = value69.findIndex(
            (input2?: Dynamic, options?: Dynamic): Dynamic =>
              options >= index12 && input2.trim() === value73,
          );
          value71 >= 0 &&
            (index12 =
              value71 +
              value72.split(`
`).length);
        }
        return value71 < 0
          ? input
          : value70.slice(value71, index12).join(`
`);
      };
      let callback22: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
      ): Dynamic => {
        let value69: Dynamic = parseFastEditReplyChunk(
            input.slice(Math.max(0, value46)),
            options,
          ),
          value70: Dynamic = (0, runtime.extractForgetStatements)(
            value69,
            options,
          );
        (0, runtime.applyForgetStatements)(history, value70.calls, index11);
        index11 = value70.calls.length;
        Object.assign(history, {
          said: options
            ? value69
            : value69.slice(
                0,
                value69.lastIndexOf(`
`) + 1,
              ),
          replied: true,
        });
        return callback21(value70.rest, options);
      };
      flag2 && fail("sandbox_failed");
      let value48: Dynamic = context.engine.call({
        turns: value45.turns,
        tier: request.tier,
        images: request.images,
        onText: (items8?: Dynamic): Dynamic => {
          if (request.signal.aborted || gateReason !== "" || value !== null)
            return;
          if (flag2) {
            value17?.();
            return;
          }
          if (value46 < 0) {
            let value70: Dynamic = /^\s*```[a-z]*[ \t]*\n/i.exec(items8);
            if (/^\s*`/.test(items8) && value70 === null) return;
            value46 =
              value70 !== null
                ? value70[0].length
                : items8.length - items8.trimStart().length;
          }
          request.report("writing", {
            chars: items8.length,
          });
          if (items8.length > runtime.MAX_FAST_EDIT_FED_CHARS) {
            flag = true;
            value17?.();
            return;
          }
          let value69: Dynamic = callback22(items8, false);
          text2 = value69.slice(
            0,
            value69.lastIndexOf(`
`) + 1,
          );
          value69.length > index10 &&
            (callback13(value69.slice(index10)), (index10 = value69.length));
          if (flag2) {
            value17?.();
            return;
          }
          timeout !== undefined && clearTimeout(timeout);
          timeout = setTimeout((): Dynamic => {
            timeout = undefined;
            !flag5 &&
              value69.endsWith(`
`) &&
              callback12((input?: Dynamic): Dynamic => input.flush());
          }, 250);
        },
      });
      value17 = (): Dynamic => value48.cancel();
      (flag2 || flag || value !== null) && value17();
      onAbort = (): Dynamic => {
        value48.cancel();
        sandbox?.stop();
      };
      request.signal.addEventListener("abort", onAbort, {
        once: true,
      });
      let value49: Dynamic = await value48.promise;
      request.signal.aborted && fail("cancelled");
      value !== null && fail("ask_claude");
      value46 < 0 && (value46 = 0);
      let value50: Dynamic = callback22(value49.text, true),
        callback23: Dynamic = (input?: Dynamic): Dynamic =>
          input
            .split(
              `
`,
            )
            .filter((input2?: Dynamic): Dynamic => input2.trim() !== "").length;
      result.skipped +=
        callback23(
          stripReplyInlineBackticks(
            stripReplyCodeFences(value49.text.slice(value46)),
          ),
        ) - callback23(value50);
      text2 = value50;
      value50.length > index10 &&
        (callback13(value50.slice(index10)), (index10 = value50.length));
      callback12((input?: Dynamic): Dynamic => input.flush());
      flag5 = true;
      callback12((input?: Dynamic): Dynamic => input.end());
      let value51: Dynamic = flag2
        ? false
        : (await Promise.race([
            (0, runtime.withFastEditTimeout)(promise, 5e3),
            (0, runtime.waitForFastEditAbort)(request.signal),
          ])) !== runtime.FAST_EDIT_TIMEOUT_SENTINEL;
      request.signal.aborted && fail("cancelled");
      value !== null && fail("ask_claude");
      value49.truncated === true && fail("cut_short");
      (flag2 || !value51) && fail("sandbox_failed");
      let value52: Dynamic = value15;
      if (value52 !== null) {
        result.refusedAdd && fail("refused_add");
        result.refusedAdd = true;
        let value69: Dynamic =
            value52.id === ""
              ? "The id you gave the new screen"
              : "#" + value52.id,
          value70: Dynamic =
            (value52.code === "exists"
              ? value69 +
                " is already a screen in this document. To change it, write to it; to add a screen, pick a new id."
              : value52.code === "removed"
                ? value69 +
                  " was removed earlier in the same reply, and an id is not free again within one reply. To move or change a screen, write to it; to replace it, give the new one another id."
                : value52.code === "own"
                  ? value69 +
                    " is one of the page\u2019s own names, as is every id made of {{PREFIX}} and digits. Give the new screen a word for an id, like pricing-2."
                  : value69 +
                    " cannot be an id (a letter, then letters, digits, - and _; 24 at most). Pick another id for the new screen.") +
            " Nothing of your last reply was applied: write the whole reply again.";
        cleanup();
        request.report("thinking");
        return {
          again: {
            file: targetFile,
            by: target.by,
            report: value70,
          },
        };
      }
      if (items4.length > 0 && !result.reads) {
        result.reads = true;
        cleanup();
        request.report("thinking");
        let value69: Dynamic = new RegExp(
          ' id="' + value23.prefix + '\\d{1,6}"',
          "g",
        );
        return {
          again: {
            file: targetFile,
            by: target.by,
            logs: items4.map(
              (input?: Dynamic): Dynamic => input.replace(value69, ""),
            ),
            ...(target.report !== undefined
              ? {
                  report: target.report,
                }
              : {}),
          },
        };
      }
      index8 > runtime.MAX_FAST_EDIT_FRAME_OUTPUT_CHARS &&
        refuseGate("too_big");
      values2.size > 0 && refuseGate("box_cannot_hold");
      let state3: Dynamic = {
        asked: targetFile,
        templates: new Map(),
        places: new Map(),
        renames: new Map(),
        adds: [],
        duplicates: [],
        deletes: [],
        pages: new Map(),
      };
      ([...templates].some(
        ([input, input2]: Dynamic): Dynamic =>
          runtime.TRUNCATED_DATA_URI_PATTERN.test(input2) &&
          !runtime.TRUNCATED_DATA_URI_PATTERN.test(
            artboardsById.get(input) ?? "",
          ),
      ) ||
        [
          ...entries4.values(),
          ...entries5.values(),
          ...pendingHtml.map(
            (input?: Dynamic): Dynamic =>
              "html" in input ? (input.html ?? "") : "",
          ),
        ].some(
          (input?: Dynamic): Dynamic =>
            runtime.TRUNCATED_DATA_URI_PATTERN.test(input),
        )) &&
        refuseGate("data_cut");
      let items5: Dynamic = [],
        entries14: Dynamic = new Map();
      for (let [value69, value70] of templates as Dynamic) {
        let entry4: Dynamic = artboardsById.get(value69),
          entry5: Dynamic = entries.get(value69);
        if (entry5 === undefined) continue;
        if (entry4 === undefined) {
          let value86: Dynamic = (0, runtime.parseFastEditArtboardSection)(
            value70,
          );
          if (value86 === null) return refuseGate("shape");
          ((0, runtime.unwrapFastEditSection)(value70) ?? "").trim() !== "" &&
            refuseGate("box_cannot_hold");
          let value87: Dynamic = (0, runtime.diffArtboardProperties)(
            entry5,
            value86,
          );
          Object.keys(value87.place).length > 0 &&
            state3.places.set(value69, value87.place);
          value87.title !== undefined &&
            state3.renames.set(value69, value87.title);
          continue;
        }
        let value71: Dynamic = (0, runtime.rehydrateFastEditHtml)(
            entry4,
            value70,
            value13,
          ),
          value72: Dynamic = (0, runtime.parseFastEditArtboardSection)(
            value70,
            new Set(["background", "color", "font"]),
          );
        if (value72 === null) return refuseGate("shape");
        let state4: Dynamic = {};
        for (let value86 of ["background", "color", "font"] as Dynamic) {
          let value87: Dynamic = value72.page?.[value86],
            value88: Dynamic = entries2.get(value69)?.[value86];
          value87 !== undefined &&
            value87.trim() !== (value88 ?? "") &&
            (state4[value86] = value87.trim());
        }
        let items8: Dynamic = ["background", "color", "font"],
          callback26: Dynamic = (input?: Dynamic): Dynamic => ({
            ...(input.font !== undefined && input.font !== ""
              ? {
                  font: input.font,
                }
              : {}),
            ...(0, runtime.validatePageStyles)(input, values),
          }),
          value73: Dynamic = items8.filter(
            (input?: Dynamic): Dynamic => state4[input] !== undefined,
          ),
          value74: Dynamic =
            context.target === undefined ||
            (value69 === context.target && context.contextOnly !== true) ||
            value69 === value26
              ? callback26((0, runtime.readPageStylesFromSection)(value70))
              : {};
        for (let value86 of items8 as Dynamic)
          state4[value86] === undefined &&
            value74[value86] !== undefined &&
            value74[value86] !== (entries2.get(value69)?.[value86] ?? "") &&
            (state4[value86] = value74[value86]);
        let value75: Dynamic = (0, runtime.validatePageStyles)(state4, values),
          value76: Dynamic = items8.filter(
            (input?: Dynamic): Dynamic =>
              value75[input] === undefined &&
              callback26(state4)[input] !== undefined,
          ),
          value77: Dynamic = Object.fromEntries(
            items8
              .filter(
                (input?: Dynamic): Dynamic =>
                  state4[input] !== undefined && !value76.includes(input),
              )
              .map((input?: Dynamic): Dynamic => [input, state4[input]]),
          ),
          value78: Dynamic =
            Object.keys(state4).length === 0
              ? {
                  ok: false,
                  why: "value",
                }
              : (0, runtime.updatePageStyleSheet)(
                  (0, runtime.preserveHelmetMarkup)(entry4, value71 ?? ""),
                  value77,
                  values,
                ),
          value79: Dynamic =
            value71 === null ||
            !(value78.ok || value78.why === "no_sheet") ||
            Object.keys(callback26(state4)).length === 0
              ? {
                  text: value71,
                  own: [],
                }
              : (0, runtime.mapFastEditCssChanges)(
                  (0, runtime.stripHelmetMarkup)(entry4),
                  value71,
                  callback26(state4),
                  [...(value78.ok ? [] : items8), ...value76],
                  {
                    w: value72.w ?? entry5.w,
                    h: value72.h ?? entry5.h,
                  },
                ),
          value80: Dynamic =
            value79.text === null
              ? {
                  ok: false,
                  code: "not_template",
                }
              : (0, runtime.validateFastEditTemplate)(
                  entry4,
                  (0, runtime.preserveHelmetMarkup)(entry4, value79.text),
                ),
          value81: Dynamic = value80.ok && value79.text !== value71,
          value82: Dynamic =
            value80.ok || value79.text === value71
              ? value80
              : (0, runtime.validateFastEditTemplate)(
                  entry4,
                  (0, runtime.preserveHelmetMarkup)(entry4, value71),
                ),
          value83: Dynamic = (0, runtime.validateFastEditTemplate)(
            entry4,
            entry4,
          );
        value82.ok
          ? (entries14.set(value69, value82.template),
            value83.ok &&
              value82.template !== value83.template &&
              state3.templates.set(value69, value82.template))
          : (items5.push({
              id: fileIds.idOf.get(value69) ?? "",
              code: value82.code,
            }),
            value83.ok && entries14.set(value69, value83.template));
        let value84: Dynamic = value76.filter(
            (input?: Dynamic): Dynamic =>
              value73.includes(input) &&
              !(value82.ok && (value79.own.includes(input) || value81)),
          ),
          state5: Dynamic = {
            ...(value78.ok
              ? value77
              : value81
                ? {}
                : Object.fromEntries(
                    value73
                      .filter(
                        (input?: Dynamic): Dynamic => !value76.includes(input),
                      )
                      .map(
                        (input?: Dynamic): Dynamic => [input, state4[input]],
                      ),
                  )),
            ...Object.fromEntries(
              value84.map((input?: Dynamic): Dynamic => [input, state4[input]]),
            ),
          };
        Object.keys(state5).length > 0 && state3.pages.set(value69, state5);
        let value85: Dynamic = (0, runtime.diffArtboardProperties)(
          entry5,
          value72,
        );
        Object.keys(value85.place).length > 0 &&
          state3.places.set(value69, value85.place);
        value85.title !== undefined &&
          state3.renames.set(value69, value85.title);
        value72.del === true &&
          !state3.deletes.includes(value69) &&
          state3.deletes.push(value69);
      }
      for (let value69 of pendingHtml as Dynamic)
        if (value69.op === "remove") {
          let entry4: Dynamic = fileIds.pathOf.get(value69.id);
          state3.deletes.includes(entry4) || state3.deletes.push(entry4);
        } else if (value69.op === "duplicate") {
          let entry4: Dynamic = fileIds.pathOf.get(value69.id),
            entry5: Dynamic = entries.get(entry4),
            value70: Dynamic =
              (value69.newId !== undefined && entries5.get(value69.newId)) ||
              value69.html,
            value71: Dynamic =
              value70 === undefined
                ? null
                : (0, runtime.parseFastEditArtboardSection)(value70);
          state3.duplicates.push({
            file: entry4,
            ...(value69.newId !== undefined
              ? {
                  id: value69.newId,
                }
              : {}),
            ...(value71?.title !== undefined && value71.title !== entry5?.title
              ? {
                  title: value71.title,
                }
              : {}),
            ...(value71?.x !== undefined &&
            value71.y !== undefined &&
            (value71.x !== entry5?.x || value71.y !== entry5?.y)
              ? {
                  x: value71.x,
                  y: value71.y,
                }
              : {}),
          });
        } else if (value69.op === "add") {
          if (
            value69.id !== undefined &&
            (values3.has(value69.id) ||
              value69.id === runtime.OPEN_ARTBOARD_PLACEHOLDER_ID)
          )
            continue;
          let value70: Dynamic =
              value69.id !== undefined
                ? (entries4.get(value69.id) ?? value69.html)
                : value69.html,
            value71: Dynamic = (0, runtime.rehydrateFastEditHtml)(
              "",
              value70,
              value13,
            ),
            value72: Dynamic = (0, runtime.parseFastEditArtboardSection)(
              value70,
            );
          if (value72 === null) return refuseGate("shape");
          let value73: Dynamic =
            value71 === null
              ? {
                  ok: false,
                  code: "not_template",
                }
              : (0, runtime.validateFastEditTemplate)("", value71);
          if (!value73.ok)
            items5.push({
              id: "",
              code: value73.code,
            });
          else {
            let value74: Dynamic = (0, runtime.validatePageStyles)(
                {
                  ...(0, runtime.readPageStylesFromSection)(value70),
                  ...value72.page,
                },
                values,
              ),
              value75: Dynamic = (0, runtime.serializePageStyleDeclarations)({
                ...value74,
                ...(value74.font !== undefined
                  ? {
                      families: (0, runtime.validatePageFontFamilies)(
                        value74.font,
                        values,
                      ),
                    }
                  : {}),
              });
            state3.adds.push({
              body: value73.template,
              title: value72.title ?? "",
              w: value72.w ?? 480,
              h: value72.h ?? 560,
              ...(value72.x !== undefined && value72.y !== undefined
                ? {
                    x: value72.x,
                    y: value72.y,
                  }
                : {}),
              ...(value69.id !== undefined
                ? {
                    id: value69.id,
                  }
                : {}),
              ...(value75 !== ""
                ? {
                    pageRule: value75,
                  }
                : {}),
            });
          }
        }
      let values4: Dynamic = new Set([
        ...state3.templates.keys(),
        ...state3.places.keys(),
        ...state3.renames.keys(),
        ...state3.pages.keys(),
        ...items5
          .map((input?: Dynamic): Dynamic => fileIds.pathOf.get(input.id) ?? "")
          .filter((input?: Dynamic): Dynamic => input !== ""),
      ]);
      state3.deletes = state3.deletes.filter(
        (input?: Dynamic): Dynamic => !values4.has(input),
      );
      let value53: Dynamic = (0, runtime.checkFastEditNewArtboardLimit)(state3);
      value53 !== null && refuseGate(value53);
      if (value8 !== undefined && state3.adds.length > 0) {
        let value69: Dynamic = state3.adds[0],
          value70: Dynamic = callback3(value69.w, value69.h),
          value71: Dynamic = value70.x - (value69.x ?? value70.x),
          value72: Dynamic = value70.y - (value69.y ?? value70.y);
        for (let value73 of state3.adds as Dynamic)
          value73 === value69
            ? Object.assign(value73, value70)
            : value73.x !== undefined &&
              value73.y !== undefined &&
              Object.assign(value73, {
                x: value73.x + value71,
                y: value73.y + value72,
              });
      }
      let value54: Dynamic = (0, runtime.prepareFastEditArtboardChanges)(
        state3,
        canvas.boards(),
        targetFile,
        entries,
        value8 !== undefined,
        value7,
      );
      for (let [value69, value70] of state3.pages as Dynamic) {
        let value71: Dynamic = (0, runtime.updatePageStyleSheet)(
          state3.templates.get(value69) ?? entries14.get(value69) ?? "",
          value70,
          values,
        );
        value71.ok
          ? state3.templates.set(value69, value71.template)
          : items5.push({
              id: fileIds.idOf.get(value69) ?? "",
              code: "page_style",
            });
      }
      context.allOrNothing === true &&
        items5.length > 0 &&
        refuseGate(items5[0].code);
      context.target !== undefined &&
        [...state3.templates.keys(), ...state3.pages.keys()].some(
          (input?: Dynamic): Dynamic =>
            (input !== context.target || context.contextOnly === true) &&
            input !== value26,
        ) &&
        refuseGate("beyond_target");
      context.allOrNothing === true && index5 > 0 && refuseGate("thrown");
      let value55: Dynamic =
        state3.templates.size +
          state3.places.size +
          state3.renames.size +
          state3.adds.length +
          state3.duplicates.length +
          state3.deletes.length ===
        0;
      value3 !== null &&
        (context.allOrNothing === true || value55) &&
        refuseGate("line_no_match");
      value55 && items5.length > 0 && refuseGate(items5[0].code);
      value55 &&
        items4.length > 0 &&
        target.logs !== undefined &&
        fail("read_twice");
      if (value55)
        throw {
          code:
            value49.text.trim() !== "" &&
            pendingHtml.length === 0 &&
            templates.size === 0 &&
            index2 === 0
              ? "words_only"
              : index2 > 0 && index4 === 0
                ? index6 > 0
                  ? "already_so"
                  : "no_match"
                : index2 === 0
                  ? "not_run"
                  : "no_change",
        };
      for (let [value69, value70] of state3.templates as Dynamic) {
        let value71: Dynamic = (0, runtime.validateArtboardTemplateReplacement)(
          context.host().fileText(value69) ?? "",
          value70,
        );
        if (!value71.ok) return refuseGate(value71.code);
        value69 !== targetFile &&
          (await (0, runtime.verifySandboxTemplateRoundTrip)(
            context.sandbox,
            (0, runtime.stripHelmetMarkup)(artboardsById.get(value69)),
          )) !== "held" &&
          refuseGate("box_cannot_hold");
        (0, runtime.countEmptySvgDrawings)(value70) >
          (0, runtime.countEmptySvgDrawings)(
            artboardsById.get(value69) ?? "",
          ) && refuseGate("empty_drawing");
      }
      state3.adds.some(
        (input?: Dynamic): Dynamic =>
          (0, runtime.countEmptySvgDrawings)(input.body) > 0,
      ) && refuseGate("empty_drawing");
      let value56: Dynamic = await Promise.all(
        [
          ...[...state3.templates.values()].map(runtime.stripHelmetMarkup),
          ...state3.adds.map(
            (input?: Dynamic): Dynamic =>
              (0, runtime.stripHelmetMarkup)(input.body),
          ),
        ].map(
          (input?: Dynamic): Dynamic =>
            (0, runtime.verifySandboxTemplateRoundTrip)(context.sandbox, input),
        ),
      );
      value56.includes("reshaped") && refuseGate("reshaped");
      value56.includes("late") && fail("sandbox_failed");
      request.signal.aborted && fail("cancelled");
      context.host().readOnly && fail("read_only");
      unsubscribe = await canvas.hold();
      let value57: Dynamic = await Promise.all(
        [...state3.templates.keys()].map(
          async (input?: Dynamic): Promise<Dynamic> => [
            input,
            await handles
              .get(input)
              ?.askTemplate()
              .catch((): Dynamic => null),
          ],
        ),
      );
      request.signal.aborted && fail("cancelled");
      let value58: Dynamic = value57
        .filter(
          ([input, input2]: Dynamic): Dynamic =>
            input2 !== artboardsById.get(input) || context.holds(input),
        )
        .map(([input]: Dynamic): Dynamic => input);
      if (value58.length > 0) {
        errors.push(
          ...value58.map(
            (input?: Dynamic): Dynamic => fileIds.idOf.get(input) ?? "",
          ),
        );
        for (let value69 of state3.templates.keys() as Dynamic)
          allowedFiles.add(value69);
        throw {
          code: "conflict",
        };
      }
      let value59: Dynamic = !result.applied,
        items6: Dynamic = [];
      for (let value69 of state3.templates.keys() as Dynamic)
        value59 &&
          entries11.has(value69) &&
          callback12((input?: Dynamic): Dynamic => {
            items6.push(
              input.view(fileIds.idOf.get(value69)).then(
                (input2?: Dynamic): Dynamic => {
                  input2 !== null &&
                    typeof input2.html == "string" &&
                    entries12.set(value69, input2.html);
                },
                (): Dynamic => {},
              ),
            );
          });
      let value60: Dynamic = (0, runtime.withFastEditTimeout)(
        Promise.all(items6),
        context.viewAfterMs ?? runtime.FAST_EDIT_INITIAL_DELAY_MS,
      );
      flag4 = true;
      let values5: Dynamic = new Set(),
        flag6: Dynamic = false,
        callback24: Dynamic = (): Dynamic => {},
        entries15: Dynamic = new Map(
          [...state3.templates.keys()].map(
            (input?: Dynamic): Dynamic => [
              input,
              context.host().fileText(input),
            ],
          ),
        ),
        values6: Dynamic = new Set(),
        value61: Dynamic = context.onDocEvent?.((input?: Dynamic): Dynamic => {
          if (input.type === "event") return;
          let value69: Dynamic = input.paths.map(
            (input2?: Dynamic): Dynamic => input2.replace(/^project\//, ""),
          );
          if (input.type === "started") {
            for (let value70 of value69 as Dynamic)
              (value70 === "canvas.json" ||
                context.host().fileText(value70) !== entries15.get(value70)) &&
                values6.add(String(input.n) + " " + value70);
            return;
          }
          if (input.type === "landed")
            for (let value70 of value69 as Dynamic)
              values6.has(String(input.n) + " " + value70) &&
                values5.add(value70);
          else if (input.code === "conflict") flag6 = true;
          else return;
          callback24();
        }),
        value62: Dynamic = canvas.depth(),
        value63: Dynamic = await (0, runtime.commitFastEditArtboardChanges)(
          state3,
          canvas,
          handles,
          entries,
          value54,
          request.signal,
          artboardsById,
        );
      unsubscribe();
      for (let value69 of value63.stale as Dynamic)
        items5.push({
          id: fileIds.idOf.get(value69) ?? "",
          code: "changed",
        });
      if (value63.nothingLanded && value63.stale.length > 0) {
        value61?.();
        errors.push(
          ...value63.stale.map(
            (input?: Dynamic): Dynamic => fileIds.idOf.get(input) ?? "",
          ),
        );
        for (let value69 of state3.templates.keys() as Dynamic)
          allowedFiles.add(value69);
        throw (
          (flag4 = false),
          {
            code: "conflict",
          }
        );
      }
      value63.nothingLanded && (value61?.(), fail("not_saved"));
      result.applied = true;
      let value64: Dynamic = (0, runtime.withFastEditTimeout)(
        Promise.all(
          value63.landed.map(
            (input?: Dynamic): Dynamic =>
              handles
                .get(input)
                ?.flushPending()
                .catch((): Dynamic => {}),
          ),
        ),
        runtime.FAST_EDIT_SANDBOX_START_TIMEOUT_MS,
      ).then((): Dynamic => {
        try {
          context.host().saveNow();
        } catch {}
      });
      index = value63.records;
      let value65: Dynamic = value62 + value63.pushes;
      for (
        let index12: Dynamic = 0;
        index12 < 40 && canvas.depth() < value65;
        index12++
      )
        await sleep(40);
      value2 = canvas.depth() === value65 ? canvas.mark() : null;
      flag3 =
        value63.stale.length === 0 &&
        value63.landed.length === state3.templates.size &&
        value63.added.length === state3.adds.length &&
        value63.copied.length === state3.duplicates.length &&
        value63.removed.length === state3.deletes.length &&
        !request.signal.aborted;
      for (let value69 of [
        ...value63.landed,
        ...value63.moved,
        ...value63.renamed,
      ] as Dynamic)
        result.changed.add(value69);
      for (let value69 of [...value63.added, ...value63.copied] as Dynamic)
        result.added.add(value69);
      for (let value69 of value63.removed as Dynamic)
        result.removed.add(value69);
      setTimeout((): Dynamic => runtime.draftHtmlPreviewStore.clear(), 350);
      if (context.session.turn !== null) {
        let turn: Dynamic = context.session.turn,
          value69: Dynamic = (turn.also ??= []),
          value70: Dynamic = canvas.boards(),
          idOf: Dynamic = (0, runtime.createFastEditFileIds)(
            value70
              .map((input?: Dynamic): Dynamic => input.file)
              .slice(0, runtime.MAX_FAST_EDIT_FILES),
          ).idOf,
          callback26: Dynamic = async (input?: Dynamic): Promise<Dynamic> => {
            let value71: Dynamic = await (0, runtime.withFastEditTimeout)(
                handles
                  .get(input)
                  ?.askTemplate()
                  .catch((): Dynamic => null) ?? Promise.resolve(null),
                2500,
              ),
              value72: Dynamic = value70.find(
                (input2?: Dynamic): Dynamic => input2.file === input,
              ),
              entry4: Dynamic = idOf.get(input);
            return typeof value71 == "string" &&
              value72 !== undefined &&
              entry4 !== undefined
              ? serializePromptArtboardWithPageStyle(
                  entry4,
                  value72,
                  value71,
                  values,
                )
              : undefined;
          };
        for (let value71 of new Set([
          ...(value5 ? [] : [targetFile]),
          ...value63.landed,
          ...value63.moved,
          ...value63.renamed,
        ]) as Dynamic) {
          let value72: Dynamic =
            value71 === turn.file
              ? turn
              : value69.find(
                  (input?: Dynamic): Dynamic => input.file === value71,
                );
          value72 === undefined &&
            value69.push(
              (value72 = {
                file: value71,
                before: artboardsById.has(value71) ? callback5(value71) : "",
              }),
            );
          let value73: Dynamic = await callback26(value71);
          value73 !== undefined &&
            ((value72.after = value73),
            delete value72.ids,
            context.comment === undefined &&
              context.session.seen.set(value71, value73));
        }
        for (let value71 of [...value63.added, ...value63.copied] as Dynamic) {
          let value72: Dynamic = await callback26(value71);
          value69.push({
            file: value71,
            how: "new",
            ...(value72 !== undefined
              ? {
                  after: value72,
                }
              : {}),
          });
        }
        for (let value71 of value63.removed as Dynamic)
          value69.push({
            file: value71,
            how: "removed",
          });
      }
      context.session.lastTouched =
        value63.added[value63.added.length - 1] ??
        value63.copied[value63.copied.length - 1] ??
        [...state3.templates.keys()][0] ??
        [...state3.places.keys()][0] ??
        [...state3.renames.keys()][0] ??
        targetFile;
      let value66: Dynamic =
        value63.added[0] ?? value63.copied[0] ?? value63.moved[0];
      if (value66 !== undefined && !context.pointerDown())
        try {
          canvas.reveal(value66);
        } catch {}
      if (
        (items5.length > 0 || index5 > 0 || value3 !== null) &&
        context.allOrNothing !== true &&
        !result.partly &&
        !request.signal.aborted &&
        canvas
          .boards()
          .some((input?: Dynamic): Dynamic => input.file === targetFile)
      ) {
        result.partly = true;
        let value69: Dynamic = [
            ...new Set(
              [
                ...value63.landed,
                ...state3.places.keys(),
                ...state3.renames.keys(),
              ]
                .map(
                  (input?: Dynamic): Dynamic => fileIds.idOf.get(input) ?? "",
                )
                .concat(
                  value63.added.map(
                    (input?: Dynamic): Dynamic =>
                      input.replace(/\.dc\.html$/, ""),
                  ),
                ),
            ),
          ]
            .filter((input?: Dynamic): Dynamic => input !== "")
            .slice(0, 12),
          value70: Dynamic =
            "PART of your last reply is in" +
            (value69.length > 0
              ? ": " +
                value69
                  .map((input?: Dynamic): Dynamic => "#" + input)
                  .join(", ")
              : "") +
            ". NOT in: " +
            [
              ...items5
                .slice(0, 4)
                .map(
                  (input?: Dynamic): Dynamic =>
                    (input.id !== "" ? "#" + input.id : "a new artboard") +
                    " (" +
                    input.code +
                    "): " +
                    (runtime.FAST_EDIT_REPAIR_MESSAGES[input.code] ??
                      runtime.FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS),
                ),
              ...(index5 > 0
                ? [
                    String(index5) +
                      (index5 === 1 ? " line" : " lines") +
                      " threw: " +
                      runtime.FAST_EDIT_REPAIR_MESSAGES.thrown,
                  ]
                : []),
              ...(value3 !== null
                ? [runtime.FAST_EDIT_REPAIR_MESSAGES.line_no_match]
                : []),
            ].join(" ") +
            " The canvas below is as it is NOW: do only what is still missing, another way; do not repeat what is in.";
        cleanup();
        request.report("thinking");
        return {
          again: {
            file: targetFile,
            by: target.by,
            report: value70,
            ...(value3 !== null
              ? {
                  line: callback(value3),
                }
              : {}),
          },
        };
      }
      let text3: Dynamic = "";
      if (value61 !== undefined) {
        let value69: Dynamic = value63.landed.filter(
          (input?: Dynamic): Dynamic => !state3.deletes.includes(input),
        );
        context.comment !== undefined && value69.push(...value63.added);
        value63.canvasOps > 0 && value69.push("canvas.json");
        let callback26: Dynamic = (): Dynamic =>
          flag6
            ? "save_clash"
            : value69.every((input?: Dynamic): Dynamic => values5.has(input))
              ? ""
              : null;
        await Promise.race([
          value64,
          new Promise((input?: Dynamic): Dynamic => {
            callback24 = input;
          }),
        ]);
        text3 =
          callback26() ??
          (await new Promise((input?: Dynamic): Dynamic => {
            callback24 = (): Dynamic => {
              let value70: Dynamic = callback26();
              value70 !== null && input(value70);
            };
            sleep(runtime.FAST_EDIT_ROUNDTRIP_TIMEOUT_MS).then(
              (): Dynamic => input("save_unknown"),
            );
          }));
        value61();
      }
      await value60;
      let callback25: Dynamic = (input?: Dynamic): Dynamic =>
          Array.from(
            input.matchAll(/\sid="([^"]*)"/g),
            (input2?: Dynamic): Dynamic => input2[1],
          ),
        value67: Dynamic = new RegExp("^" + value23.prefix + "\\d{1,6}$"),
        values7: Dynamic = new Set([...entries11.values()].flatMap(callback25)),
        values8: Dynamic = new Set(
          history.said.match(
            new RegExp("\\b" + value23.prefix + "\\d{1,6}\\b", "g"),
          ) ?? [],
        );
      for (let [value69, value70] of [...entries12] as Dynamic) {
        let values9: Dynamic = new Set(callback25(value70));
        [...values9].some(
          (input?: Dynamic): Dynamic =>
            !values7.has(input) && (!value67.test(input) || values8.has(input)),
        ) &&
          callback25(entries11.get(value69) ?? "").some(
            (input?: Dynamic): Dynamic => !values9.has(input),
          ) &&
          entries12.delete(value69);
      }
      let items7: Dynamic = [
        ...(value33 !== null ? [value33.id] : []),
        ...value38.map((input?: Dynamic): Dynamic => input.id),
        ...Array.from(
          history.said.matchAll(
            new RegExp("#(" + value23.prefix + "\\d{1,6})(?![\\w-])", "g"),
          ),
          (input?: Dynamic): Dynamic => input[1],
        ),
      ];
      for (let value69 of (context.session.turn === null
        ? []
        : [
            context.session.turn,
            ...(context.session.turn.also ?? []),
          ]) as Dynamic) {
        let entry4: Dynamic = entries11.get(value69.file),
          entry5: Dynamic = entries12.get(value69.file);
        entry4 !== undefined &&
          entry5 !== undefined &&
          value69.after !== undefined &&
          (value69.ids = {
            before: entry4,
            after: entry5,
            prefix: value23.prefix,
            acted: items7,
          });
      }
      cleanup();
      let value68: Dynamic =
        text3 !== ""
          ? finish("failed", text3, runtime.FAST_EDIT_ERROR_MESSAGES[text3])
          : items5.length > 0 || index5 > 0 || value3 !== null
            ? finish(
                "saved",
                "partly_kept",
                runtime.FAST_EDIT_ERROR_MESSAGES.partly_kept,
              )
            : finish("saved");
      "done" in value68 &&
        ((value68.done.changed = [...result.changed, ...result.added].map(
          (input?: Dynamic): Dynamic =>
            fileIds.idOf.get(input) ?? input.replace(/\.dc\.html$/, ""),
        )),
        (value68.done.steps = index),
        (value68.done.mark = value2),
        (value68.done.whole = flag3 && value68.done.code === ""),
        (text3 === "save_clash" || text3 === "save_unknown") &&
          (value68.done.unsaved = text3),
        value68.done.outcome === "saved" &&
          [
            ...(value35 ? [value33] : []),
            ...value38.filter((input?: Dynamic): Dynamic => input.inList),
          ].some(
            (input?: Dynamic): Dynamic =>
              (0, runtime.readTemplateLoopHtml)(value11, input.list) !==
              (0, runtime.readTemplateLoopHtml)(
                state3.templates.get(targetFile) ?? value11,
                input.list,
              ),
          ) &&
          (value68.done.inList = true));
      if (
        "done" in value68 &&
        value68.done.whole === true &&
        value59 &&
        !request.signal.aborted
      ) {
        let entries16: Dynamic = new Map(),
          entries17: Dynamic = new Map(),
          entries18: Dynamic = new Map(),
          value69: Dynamic =
            state3.adds.length === 0 &&
            state3.duplicates.length === 0 &&
            [...state3.templates.keys()].every(
              (input?: Dynamic): Dynamic => entries11.has(input),
            );
        for (let [value70, value71] of entries11 as Dynamic) {
          let value72: Dynamic = [
              context.session.turn,
              ...(context.session.turn?.also ?? []),
            ].find((input?: Dynamic): Dynamic => input?.file === value70),
            entry4: Dynamic = entries12.get(value70),
            value73: Dynamic = state3.templates.has(value70),
            value74: Dynamic = callback16(value73 ? (entry4 ?? "") : value71);
          if (
            value73 &&
            (entry4 === undefined ||
              value72?.after === undefined ||
              value74.shape !== callback16(value72.after).shape)
          ) {
            value69 = false;
            continue;
          }
          value74.ids.forEach(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              entries16.set(input, {
                file: value70,
                at: options,
              }),
          );
          if (value73)
            for (let value75 of callback16(value71).ids as Dynamic)
              entries17.set(value75, value70);
          entries18.set(value70, {
            text: value73 ? value72.after : callback5(value70),
            shape: value74.shape,
          });
        }
        context.session.named = {
          at: [...new Set(items7)].flatMap((input?: Dynamic): Dynamic => {
            let value70: Dynamic =
              entries16.get(input) ??
              (value69 && entries17.has(input)
                ? {
                    file: entries17.get(input),
                    at: -1,
                  }
                : undefined);
            return value70 === undefined
              ? []
              : [
                  {
                    was: input,
                    ...value70,
                  },
                ];
          }),
          states: entries18,
        };
      }
      return value68;
    } catch (value5: Dynamic) {
      cleanup();
      let value6: Dynamic = (0, runtime.normalizeFastEditThrownError)(value5),
        aborted: Dynamic = request.signal.aborted;
      if (value !== null && !aborted)
        return {
          done: {
            outcome: "failed",
            code: "ask_claude",
            message: runtime.FAST_EDIT_ERROR_MESSAGES.ask_claude,
            calls: result.calls,
            made: summarizeFastEditAppliedChanges(result),
            forClaude: value,
          },
        };
      if (value6.code === "conflict" && !aborted) {
        result.conflicts += 1;
        if (result.conflicts > 1)
          return finish(
            result.applied ? "saved" : "failed",
            "conflict_again",
            runtime.FAST_EDIT_ERROR_MESSAGES.conflict_again,
          );
        request.report("thinking");
        let value10: Dynamic = 250 + Math.floor(Math.random() * 900),
          text3: Dynamic = "",
          index3: Dynamic = 0,
          index4: Dynamic = 0;
        for (
          ;
          index3 < 6e3 &&
          (index3 < value10 ||
            index4 < 900 ||
            [...allowedFiles].some(
              (input?: Dynamic): Dynamic => context.holds(input),
            )) &&
          !request.signal.aborted;

        ) {
          await sleep(100);
          index3 += 100;
          index4 += 100;
          let value13: Dynamic = (
            await Promise.all(
              [...allowedFiles].map(
                (input?: Dynamic): Dynamic =>
                  handles
                    .get(input)
                    ?.askTemplate()
                    .catch((): Dynamic => null) ?? null,
              ),
            )
          ).join("\0");
          value13 !== text3 && ((text3 = value13), (index4 = 0));
        }
        if (request.signal.aborted) return finish("stopped", "cancelled");
        let value11: Dynamic = [...new Set(errors)].filter(
            (input?: Dynamic): Dynamic => input !== "",
          ),
          value12: Dynamic =
            "While you were writing, " +
            (value11.length > 0
              ? "artboard " +
                value11
                  .map((input?: Dynamic): Dynamic => '"' + input + '"')
                  .join(", ")
              : "an artboard") +
            " was changed by someone else. Nothing of your reply was taken. The canvas below is as it is NOW: answer the request again for it, changing only what is still needed.";
        return {
          again: {
            file: targetFile,
            by: target.by,
            report: value12,
          },
        };
      }
      let value7: Dynamic = gateReason !== "" && !aborted;
      if (
        value7 ||
        (runtime.FAST_EDIT_NOOP_CODES.has(value6.code) && !aborted)
      ) {
        if (result.applied)
          return finish(
            "saved",
            "partly_kept",
            runtime.FAST_EDIT_ERROR_MESSAGES.partly_kept,
          );
        let value10: Dynamic = value7
            ? gateReason.startsWith("cap_") ||
              gateReason === "thrown" ||
              gateReason === "line_no_match" ||
              gateReason === "empty_drawing" ||
              gateReason === "beyond_target"
              ? gateReason
              : "gate_" + gateReason
            : value6.code === "no_match" || value6.code === "already_so"
              ? value6.code
              : "no_change",
          nothing: Dynamic = runtime.FAST_EDIT_ERROR_MESSAGES.nothing,
          value11: Dynamic = text2
            .split(
              `
`,
            )
            .map(
              (input?: Dynamic): Dynamic => input.replace(/\s+/g, " ").trim(),
            )
            .filter((input?: Dynamic): Dynamic => input !== ""),
          refused: Dynamic = result.refused;
        result.refused = value11;
        if (
          context.comment !== undefined &&
          refused !== null &&
          refused.length > 0 &&
          value11.length > 0 &&
          refused
            .slice(0, value11.length)
            .every(
              (input?: Dynamic, options?: Dynamic): Dynamic =>
                input === value11[options],
            )
        )
          return finish("failed", value10, nothing);
        if (
          result.fixes.length < runtime.MAX_FAST_EDIT_READ_ROUNDS &&
          !(
            (value10 === "no_change" || value10 === "beyond_target") &&
            result.fixes.includes(value10)
          )
        ) {
          result.fixes.push(value10);
          request.report("thinking");
          let value12: Dynamic =
            value10 === "already_so"
              ? runtime.FAST_EDIT_REPAIR_MESSAGES.already_so
              : (0, runtime.describeFastEditRefusal)(
                  value10,
                  value7 ? gateReason : value10,
                );
          return {
            again: {
              file: targetFile,
              by: target.by,
              report: value12,
              ...(gateReason === "line_no_match" && value3 !== null
                ? {
                    line: callback(value3),
                  }
                : {}),
            },
          };
        }
        return finish("failed", value10, nothing);
      }
      if (!flag && (aborted || (value6.code === "cancelled" && !flag2)))
        return finish("stopped", "cancelled");
      let value8: Dynamic = flag
        ? "too_long"
        : flag2 && value6.code === "cancelled"
          ? "sandbox_failed"
          : value6.code;
      if (value8 === "call_cap" && result.applied)
        return finish(
          "saved",
          "call_cap",
          runtime.FAST_EDIT_ERROR_MESSAGES.call_cap,
        );
      let value9: Dynamic =
        runtime.FAST_EDIT_ERROR_MESSAGES[
          !firstCall &&
          (value8 === "no_box" ||
            value8 === "slow_start" ||
            value8 === "start_stuck")
            ? "sandbox_failed"
            : value8
        ] ??
        (runtime.FAST_EDIT_CAPABILITY_DENIED_CODES.has(value8)
          ? runtime.FAST_EDIT_CAPABILITY_UNAVAILABLE_MESSAGE
          : runtime.FAST_EDIT_ERROR_MESSAGES.upstream_error);
      return finish(
        "failed",
        value8,
        result.applied
          ? value9.replace("Nothing changed.", "Changes already made are kept.")
          : value9,
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "selectedFastEditFile",
    () => selectedFastEditFile,
    (value) => {
      selectedFastEditFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveFastEditFileTarget",
    () => resolveFastEditFileTarget,
  );
  bindRuntimeValue(
    runtime,
    "summarizeFastEditAppliedChanges",
    () => summarizeFastEditAppliedChanges,
    (value) => {
      summarizeFastEditAppliedChanges = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializePromptArtboardWithPageStyle",
    () => serializePromptArtboardWithPageStyle,
    (value) => {
      serializePromptArtboardWithPageStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateFastEditHistoryFromCanvas",
    () => updateFastEditHistoryFromCanvas,
  );
  bindRuntimeValue(
    runtime,
    "captureFastEditCanvasState",
    () => captureFastEditCanvasState,
  );
  bindRuntimeValue(
    runtime,
    "stripReplyCodeFences",
    () => stripReplyCodeFences,
    (value) => {
      stripReplyCodeFences = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripReplyInlineBackticks",
    () => stripReplyInlineBackticks,
    (value) => {
      stripReplyInlineBackticks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JS_IDENTIFIER_PATTERN",
    () => JS_IDENTIFIER_PATTERN,
    (value) => {
      JS_IDENTIFIER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_REPLY_PREFIX_PATTERN",
    () => FAST_EDIT_REPLY_PREFIX_PATTERN,
    (value) => {
      FAST_EDIT_REPLY_PREFIX_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "extractFastEditReplyStatements",
    () => extractFastEditReplyStatements,
  );
  bindRuntimeValue(
    runtime,
    "BARE_FAST_EDIT_SELECTOR_PATTERN",
    () => BARE_FAST_EDIT_SELECTOR_PATTERN,
    (value) => {
      BARE_FAST_EDIT_SELECTOR_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseFastEditReplyChunk",
    () => parseFastEditReplyChunk,
  );
  bindRuntimeValue(runtime, "applyFastEditRequest", () => applyFastEditRequest);
  bindRuntimeValue(
    runtime,
    "runFastEditSamplingRound",
    () => runFastEditSamplingRound,
  );
  return () => {
    selectedFastEditFile = (input?: Dynamic, options?: Dynamic): Dynamic =>
      [
        ...(input.selectedElements ?? []).map(
          (input2?: Dynamic): Dynamic => input2.file,
        ),
        ...input.selected,
      ].find((input2?: Dynamic): Dynamic => options.includes(input2));
    summarizeFastEditAppliedChanges = (input?: Dynamic): Dynamic => ({
      changed: [...input.changed].filter(
        (input2?: Dynamic): Dynamic =>
          !input.added.has(input2) && !input.removed.has(input2),
      ).length,
      added: [...input.added].filter(
        (input2?: Dynamic): Dynamic => !input.removed.has(input2),
      ).length,
      removed: [...input.removed].filter(
        (input2?: Dynamic): Dynamic => !input.added.has(input2),
      ).length,
    });
    serializePromptArtboardWithPageStyle = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
    ): Dynamic =>
      (0, runtime.serializeFastEditArtboard)(
        input,
        options,
        (0, runtime.hasPageStylesheet)(context)
          ? (0, runtime.serializePageStyleAttributes)(
              (0, runtime.readPageStylesFromSheet)(context, value),
            )
          : "",
      ) +
      (0, runtime.encodeCamelCaseAttributes)(
        (0, runtime.stripHelmetMarkup)(context),
      ) +
      "</section>";
    stripReplyCodeFences = (input?: Dynamic): Dynamic =>
      input.replace(/^[ \t]*```[a-z]*[ \t]*(?:\n|$)/gim, "");
    stripReplyInlineBackticks = (input?: Dynamic): Dynamic =>
      input.replace(
        /^`((?:\$\(|\.|askClaude\(|read\(|log\().*)`[ \t]*$/gm,
        "$1",
      );
    JS_IDENTIFIER_PATTERN = "[A-Za-z_$][\\w$]*";
    FAST_EDIT_REPLY_PREFIX_PATTERN = new RegExp(
      "^\\s*(?:" +
        [
          "[$(\\[{)\\]}'\"`;]",
          "\\.[A-Za-z_$]",
          "//",
          "/\\*",
          "![$(!\\w]",
          "(?:\\+\\+|--)[$(\\w]",
          JS_IDENTIFIER_PATTERN +
            "\\s*(?:\\??\\.[A-Za-z_$]|[(\\[]|[-+*/%&|^]?=|\\+\\+|--)",
          "(?:var|let|const)\\s+" + JS_IDENTIFIER_PATTERN + "\\s*[=,;]",
          "(?:var|let|const)\\s*[\\[{]",
          "return[\\s;]",
          "function(?:\\s*\\*\\s*|\\s+)" + JS_IDENTIFIER_PATTERN + "\\s*\\(",
          "new\\s+" +
            JS_IDENTIFIER_PATTERN +
            "(?:\\." +
            JS_IDENTIFIER_PATTERN +
            ")*\\s*\\(",
          "(?:do|try|else|finally)\\s*\\{",
          "else\\s+if\\s*\\(",
          "throw\\s+(?:new\\s|[$('\"`])",
          "(?:typeof|void|delete|await)\\s+(?:[$(\\['\"`]|" +
            JS_IDENTIFIER_PATTERN +
            "\\s*[.(\\[])",
          "async\\s+function[\\s(*]",
          "class\\s+" + JS_IDENTIFIER_PATTERN + "\\s*(?:\\{|extends\\s)",
        ].join("|") +
        ")",
    );
    BARE_FAST_EDIT_SELECTOR_PATTERN =
      /^[ \t]*(?!(?:askClaude|read|log|forget|jQuery|if|for|while|switch|catch|with|function|return|typeof|void|delete|await|new|throw|super|import)\()[A-Za-z_][\w$]*\(/;
  };
}
