/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFindCanvasAdapter(runtime: RuntimeBindings): () => void {
  var findExcludedEditorSelector: Dynamic;
  var findFrameProbeTimeoutMs: Dynamic;
  var findFrameCaptureTimeoutMs: Dynamic;
  var findViewportRestoreTimeoutMs: Dynamic;
  var findViewportTransformTolerance: Dynamic;
  var findArtboardTitle: Dynamic;
  var waitForFindReveal: Dynamic;
  var textRunCacheLimit: Dynamic;
  var cachedDesignTextRuns: Dynamic;
  function normalizedElementBox(element?: Dynamic, box?: Dynamic): Dynamic {
    let value: Dynamic = element.clientWidth || 1,
      value2: Dynamic = element.clientHeight || 1,
      value3: Dynamic = Math.min(Math.max(box.x, 0), value),
      value4: Dynamic = Math.min(Math.max(box.y, 0), value2);
    return {
      x: value3 / value,
      y: value4 / value2,
      w: (Math.min(Math.max(box.x + box.w, value3), value) - value3) / value,
      h: (Math.min(Math.max(box.y + box.h, value4), value2) - value4) / value2,
    };
  }
  function annotationTextLines(annotation?: Dynamic): Dynamic {
    if (annotation.kind === "title1")
      return (0, runtime.NotesDomHandler_2)(annotation.text).split(`
`);
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      (0, runtime.NotesBlocksHandler)(input)
        .map((input2?: Dynamic): Dynamic => input2.text)
        .join("");
    return (0, runtime.parseNoteBlocks)(annotation.text).flatMap(
      (source?: Dynamic): Dynamic =>
        source.kind === "p"
          ? [callback(source.text)]
          : source.items.map(callback),
    );
  }
  function canRevealFindMatch(
    settled?: Dynamic,
    target?: Dynamic,
    range?: Dynamic,
  ): Dynamic {
    return settled || !target || !range;
  }
  function revealFindMatchAfterTextEdit(
    event?: Dynamic,
    textEditOpen?: Dynamic,
    reveal?: Dynamic,
    settle?: Dynamic,
    commit?: Dynamic,
  ): Dynamic {
    if (textEditOpen || event.target?.isContentEditable !== true)
      return reveal();
    settle((): Dynamic => {
      reveal();
      commit();
    });
  }
  function revealFindMatchAfterSettle(
    needsSettle?: Dynamic,
    reveal?: Dynamic,
    settle?: Dynamic,
    commit?: Dynamic,
  ): Dynamic {
    if (!needsSettle) return reveal();
    settle((): Dynamic => {
      reveal();
      commit();
    });
  }
  function runFindRevealAfterSettle(
    needsSettle?: Dynamic,
    signal?: Dynamic,
    settle?: Dynamic,
    reveal?: Dynamic,
  ): Dynamic {
    if (!needsSettle) {
      reveal();
      return;
    }
    return new Promise(
      (input?: Dynamic): Dynamic =>
        settle((): Dynamic => {
          let flag: Dynamic = false;
          try {
            signal.aborted || (reveal(), (flag = true));
          } finally {
            input(flag);
          }
        }),
    );
  }
  function createCanvasFindAdapter(
    environment?: Dynamic,
    timeoutMs: Dynamic = findViewportRestoreTimeoutMs,
  ): Dynamic {
    let values: Dynamic = new Set(),
      entries: Dynamic = new Map(),
      values2: Dynamic = new Set(),
      value: Dynamic = null,
      text: Dynamic = "",
      text2: Dynamic = "",
      values3: Dynamic = new Set(),
      entries2: Dynamic = new Map(),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        "scrollY" in input
          ? [input.scrollX, input.scrollY]
          : [input.scrollLeft, input.scrollTop],
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        ("scrollY" in input
          ? input.document.documentElement
          : input
        ).getClientRects().length !== 0,
      callback3: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic =>
        (0, runtime.revealTextRange)(input, {
          ...options,
          onScroll: (input2?: Dynamic): Dynamic => {
            let value2: Dynamic =
              "scrollY" in input2 || input2 === options.card;
            entries2.set(input2, {
              from:
                entries2.get(input2)?.from ??
                (value2 && context() ? [0, 0] : callback(input2)),
              free: context,
              owed: false,
            });
          },
        }),
      callback4: Dynamic = (
        input: Dynamic = null,
        options: Dynamic = false,
      ): Dynamic => {
        for (let [value2, value3] of [...entries2] as Dynamic)
          try {
            if (
              "scrollY" in value2
                ? value2.closed || value2.frameElement?.isConnected !== true
                : !value2.isConnected ||
                  value2.ownerDocument.defaultView === null
            ) {
              entries2.delete(value2);
              continue;
            }
            if (
              (options && !value3.owed) ||
              (input !== null &&
                ("scrollY" in value2
                  ? input.startContainer.ownerDocument?.defaultView === value2
                  : value2.contains(input.startContainer)))
            )
              continue;
            if (!callback2(value2) || value3.free()) {
              entries2.set(value2, {
                ...value3,
                owed: true,
              });
              continue;
            }
            entries2.delete(value2);
            value2.scrollTo({
              left: value3.from[0],
              top: value3.from[1],
              behavior: "instant",
            });
          } catch {
            entries2.delete(value2);
          }
      },
      callback5: Dynamic = (): Dynamic => {
        callback4(null, true);
        values3.clear();
        for (let value2 of [...values] as Dynamic) value2();
      },
      callback6: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context: Dynamic = text,
      ): Dynamic => {
        if (!input) return null;
        try {
          return (0, runtime.findRenderedTextRanges)(input, context, {
            limit: options,
            skip: (input2?: Dynamic): Dynamic =>
              input2.matches(findExcludedEditorSelector),
          });
        } catch {
          return null;
        }
      },
      callback7: Dynamic = (input?: Dynamic): Dynamic => {
        try {
          return environment.frame(input)?.contentDocument?.body ?? null;
        } catch {
          return null;
        }
      },
      callback8: Dynamic = (
        input?: Dynamic,
        options: Dynamic = text,
      ): Dynamic =>
        (input ?? []).flatMap(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.findTextOffsets)(input2, options).map(
              (): Dynamic => null,
            ),
        ),
      callback9: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value2 of (environment
          .canvasRoot()
          ?.querySelectorAll("[data-mega-artboard]") ?? []) as Dynamic)
          if (value2.getAttribute("data-mega-artboard") === input)
            return value2.querySelector("[data-mega-title-text]");
        return null;
      },
      callback10: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value2 of (environment
          .canvasRoot()
          ?.querySelectorAll("[data-mega-annotation]") ?? []) as Dynamic)
          if (value2.getAttribute("data-mega-annotation") === input)
            return value2;
        return null;
      },
      callback11: Dynamic = async (
        input?: Dynamic,
        options?: Dynamic,
      ): Promise<Dynamic> => {
        let value2: Dynamic = environment.pageId();
        input !== text && ((text2 = value2), values3.clear(), callback4());
        text = input;
        if (input === "") return [];
        let value3: Dynamic = environment.manifest(),
          value4: Dynamic = environment.windowFile(),
          value5: Dynamic = value4 !== null,
          value6: Dynamic =
            value3.pages && value3.pages.length > 0
              ? value3.pages.map((input2?: Dynamic): Dynamic => input2.id)
              : [""],
          items: Dynamic = [],
          callback21: Dynamic = (): Dynamic => 1001 - items.length,
          callback22: Dynamic = (
            source?: Dynamic,
            options2?: Dynamic,
          ): Dynamic => {
            let value9: Dynamic =
              source.kind === "note" ? source.id : source.file;
            options2
              .slice(0, callback21())
              .forEach((input2?: Dynamic, options3?: Dynamic): Dynamic => {
                let value10: Dynamic = [
                  source.page,
                  source.kind,
                  value9,
                  options3,
                ].join("|");
                values3.has(value10) ||
                  items.push({
                    ...source,
                    query: input,
                    index: options3,
                    range: input2,
                    key: value10,
                  });
              });
          },
          value7: Dynamic = performance.now(),
          value8: Dynamic = value6.includes(text2) ? text2 : value2;
        for (let value9 of [
          value8,
          ...value6.filter((input2?: Dynamic): Dynamic => input2 !== value8),
        ] as Dynamic) {
          let value10: Dynamic = value9 === value2,
            value11: Dynamic = value3.artboards
              .filter(
                (input2?: Dynamic): Dynamic =>
                  (0, runtime.designPageId)(input2, value3.pages) === value9 &&
                  !(value5 && input2.frameless),
              )
              .map(
                (input2?: Dynamic): Dynamic => ({
                  ...input2,
                  board: input2,
                  note: undefined,
                }),
              ),
            value12: Dynamic = value5
              ? []
              : (value3.annotations ?? [])
                  .filter(
                    (input2?: Dynamic): Dynamic =>
                      !(0, runtime.isShapeAnnotation)(input2) &&
                      input2.text !== "" &&
                      (0, runtime.designPageId)(input2, value3.pages) ===
                        value9,
                  )
                  .map(
                    (input2?: Dynamic): Dynamic => ({
                      ...(0, runtime.annotationVisibleBounds)(input2),
                      note: input2,
                      board: undefined,
                    }),
                  );
          for (let { board: value13, note: value14 } of (0,
          runtime.sortArtboardsInReadingOrder)([
            ...value11,
            ...value12,
          ]) as Dynamic) {
            if (options.aborted || callback21() <= 0) return items;
            value14 &&
              callback22(
                {
                  page: value9,
                  kind: "note",
                  id: value14.id,
                },
                (value10
                  ? callback6(
                      callback10(value14.id)?.querySelector("[data-note-text]"),
                      callback21(),
                    )
                  : null) ?? callback8(annotationTextLines(value14)),
              );
            value13 &&
              !value5 &&
              !value13.frameless &&
              callback22(
                {
                  page: value9,
                  kind: "name",
                  file: value13.file,
                },
                (value10
                  ? callback6(callback9(value13.file), callback21())
                  : null) ?? callback8([findArtboardTitle(value13)]),
              );
            let value15: Dynamic =
              value10 && (!value5 || value13?.file === value4);
            value13 &&
              callback22(
                {
                  page: value9,
                  kind: "text",
                  file: value13.file,
                },
                (value15
                  ? callback6(callback7(value13.file), callback21())
                  : null) ??
                  callback8(
                    environment.storedText?.(value13.file),
                    (0, runtime.collapseFindWhitespace)(text),
                  ),
              );
            !(performance.now() - value7 < findViewportTransformTolerance) &&
              (await waitForFindReveal(0), (value7 = performance.now()));
          }
        }
        return items;
      },
      callback12: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        new Promise((input2?: Dynamic): Dynamic => {
          let value2: Dynamic = environment.frame(input);
          if (value2 !== null || options.aborted)
            return input2(options.aborted ? null : value2);
          let callback21: Dynamic = (): Dynamic => {
              clearTimeout(value3);
              options.removeEventListener("abort", callback21);
              entries.get(input)?.delete(callback21);
              input2(options.aborted ? null : environment.frame(input));
            },
            value3: Dynamic = setTimeout(callback21, findFrameProbeTimeoutMs);
          options.addEventListener("abort", callback21);
          entries.set(input, (entries.get(input) ?? new Set()).add(callback21));
        }),
      callback13: Dynamic = async (
        input?: Dynamic,
        options?: Dynamic,
        context: Dynamic = findFrameCaptureTimeoutMs,
      ): Promise<Dynamic> => {
        let value2: Dynamic = performance.now() + context;
        for (; !input(); ) {
          if (options.aborted || performance.now() > value2) return false;
          await waitForFindReveal(50);
        }
        return !options.aborted;
      },
      callback14: Dynamic = (input?: Dynamic, element?: Dynamic): Dynamic => {
        let range: Dynamic = input.range;
        try {
          if (
            range !== null &&
            element &&
            range.startContainer.isConnected &&
            range.startContainer.ownerDocument === element.ownerDocument
          )
            return range;
        } catch {}
        let value2: Dynamic =
          callback6(element, input.index + 1, input.query) ?? [];
        input.range = value2[Math.min(input.index, value2.length - 1)] ?? null;
        return input.range;
      },
      callback15: Dynamic = (input?: Dynamic): Dynamic =>
        input !== null &&
        input.clientWidth > 0 &&
        input.getClientRects().length > 0,
      callback16: Dynamic = async (
        input?: Dynamic,
        options?: Dynamic,
      ): Promise<Dynamic> => {
        let value2: Dynamic = environment.windowFile(),
          value3: Dynamic =
            value2 === null || value2 === input.file
              ? null
              : (environment.frame(value2)?.contentWindow ?? null);
        value3 !== null &&
          !entries2.has(value3) &&
          entries2.set(value3, {
            from: [0, 0],
            free: (): Dynamic => environment.scrollsItself(value2),
            owed: false,
          });
        let value4: Dynamic = environment.showInWindow(
          input.page,
          input.file,
          options,
        );
        if (
          (value4 !== undefined && !(await value4)) ||
          !(await callback13(
            (): Dynamic => environment.windowFile() === input.file,
            options,
          )) ||
          (await callback12(input.file, options)) === null
        )
          return true;
        await waitForFindReveal(50);
        let value5: Dynamic =
          options.aborted || environment.windowFile() !== input.file
            ? null
            : callback14(input, callback7(input.file));
        return value5 === null
          ? true
          : (callback3(
              value5,
              {
                viewport: true,
              },
              (): Dynamic => environment.scrollsItself(input.file),
            ),
            !callback15(environment.frame(input.file)) ||
              (0, runtime.classifyTextRangeVisibility)(value5) !== "never");
      },
      callback17: Dynamic = async (
        input?: Dynamic,
        options?: Dynamic,
      ): Promise<Dynamic> => {
        let value2: Dynamic = environment
          .manifest()
          .artboards.find(
            (input2?: Dynamic): Dynamic => input2.file === input.file,
          );
        if (!value2) return true;
        environment.showsTextMatchesOnCanvas() &&
          environment.keepRunning(value2.file);
        if (
          environment.windowFile() !== null ||
          !environment.showsTextMatchesOnCanvas()
        )
          return callback16(input, options);
        if (input.page !== environment.pageId()) {
          let value7: Dynamic = environment.showPage(
            input.page,
            value2.file,
            options,
          );
          if (value7 !== undefined && !(await value7)) return true;
          value = value2.file;
        }
        environment.panTo(value2);
        let value3: Dynamic = await callback12(value2.file, options);
        if (
          value === value2.file &&
          value3 !== null &&
          environment.editorOn !== undefined
        ) {
          let value7: Dynamic = await callback13(
            (): Dynamic => environment.editorOn?.(value2.file) === true,
            options,
            timeoutMs,
          );
          if (options.aborted) return true;
          value = null;
          value3 = environment.frame(value2.file);
          value7 && callback5();
        }
        let value4: Dynamic =
          value3 === null ? null : callback14(input, callback7(value2.file));
        if (value3 === null || value4 === null || !callback15(value3))
          return true;
        (0, runtime.classifyTextRangeVisibility)(value4) !== "never" &&
          callback3(
            value4,
            {
              viewport: true,
            },
            (): Dynamic => environment.scrollsItself(value2.file),
          );
        let value5: Dynamic =
          (0, runtime.classifyTextRangeVisibility)(value4) === "shown"
            ? (0, runtime.rangeCanvasRect)(value4)
            : null;
        if (value5 === null) return false;
        let value6: Dynamic = normalizedElementBox(value3, value5);
        environment.panTo(
          {
            x: value2.x + value6.x * value2.w,
            y: value2.y + value6.y * value2.h,
            w: value6.w * value2.w,
            h: value6.h * value2.h,
          },
          true,
        );
        return true;
      },
      callback18: Dynamic = (input?: Dynamic): Dynamic =>
        (environment.manifest().annotations ?? []).find(
          (input2?: Dynamic): Dynamic => input2.id === input,
        ),
      callback19: Dynamic = (source?: Dynamic): Dynamic => {
        let value2: Dynamic = environment.manifest();
        if (source.kind === "name")
          return (
            value2.artboards.find(
              (input?: Dynamic): Dynamic => input.file === source.file,
            ) ?? null
          );
        let value3: Dynamic = callback18(source.id);
        return value3 ? (0, runtime.annotationVisibleBounds)(value3) : null;
      },
      callback20: Dynamic = async (
        source?: Dynamic,
        options?: Dynamic,
      ): Promise<Dynamic> => {
        if (environment.windowFile() !== null) return true;
        let value2: Dynamic = callback19(source);
        if (value2 === null) return true;
        let callback21: Dynamic = (): Dynamic =>
          source.kind === "note"
            ? callback10(source.id)
            : callback9(source.file);
        if (source.page !== environment.pageId()) {
          let value9: Dynamic = environment.showPage(
            source.page,
            undefined,
            options,
          );
          if (value9 !== undefined && !(await value9)) return true;
          await callback13((): Dynamic => callback21() !== null, options);
        }
        if (options.aborted) return true;
        let value3: Dynamic = callback21(),
          value4: Dynamic = callback14(
            source,
            source.kind === "note"
              ? value3?.querySelector("[data-note-text]")
              : value3,
          ),
          value5: Dynamic =
            source.kind === "note" ? callback18(source.id) : undefined,
          value6: Dynamic = value5
            ? value3?.querySelector("[data-note-scroll]")
            : null,
          callback22: Dynamic = (): Dynamic =>
            value6 == null ||
            /auto|scroll/.test(
              value6.ownerDocument.defaultView?.getComputedStyle(value6)
                .overflowY ?? "",
            );
        value4 !== null &&
          value3 &&
          value5 &&
          callback3(
            value4,
            {
              viewport: false,
              within: value3,
              fade: (0, runtime.isShapeAnnotation)(value5)
                ? 0
                : (0, runtime.CanvasPanZoomRound)(
                    (0, runtime.annotationTextStyle)(value5).size,
                  ),
              card: value6,
            },
            callback22,
          );
        let value7: Dynamic =
          value4 !== null &&
          value3 !== null &&
          (0, runtime.classifyTextRangeVisibility)(value4, {
            within: value3,
          }) === "never";
        if (value7 && source.kind === "note") return false;
        let value8: Dynamic =
          value4 === null || value7
            ? null
            : (0, runtime.rangeCanvasRect)(value4);
        environment.panTo(
          value8 === null ? value2 : environment.toCanvas(value8),
        );
        return true;
      };
    return {
      search: callback11,
      async reveal(source: Dynamic, options: Dynamic): Promise<Dynamic> {
        let flag: Dynamic = true;
        try {
          flag = await (source.kind === "text"
            ? callback17(source, options)
            : callback20(source, options));
        } finally {
          options.aborted || callback4(flag ? source.range : null);
        }
        !flag && !options.aborted && values3.add(source.key);
        return flag || options.aborted;
      },
      paint(input: Dynamic, options: Dynamic): Dynamic {
        let entries3: Dynamic = new Map();
        for (let { range: value3 } of input as Dynamic)
          try {
            let value4: Dynamic = value3?.startContainer.ownerDocument;
            value3 &&
              value4 &&
              value3.startContainer.isConnected &&
              entries3.set(value4, [...(entries3.get(value4) ?? []), value3]);
          } catch {
            continue;
          }
        let value2: Dynamic = input[options]?.range ?? null,
          values4: Dynamic = new Set(entries3.keys());
        for (let value3 of new Set([
          ...values2,
          ...entries3.keys(),
        ]) as Dynamic) {
          let entry: Dynamic = entries3.get(value3);
          try {
            entry
              ? (0, runtime.applyFindHighlights)(
                  value3,
                  entry,
                  value2 !== null && entry.includes(value2) ? value2 : null,
                )
              : (0, runtime.clearFindHighlights)(value3);
          } catch {
            values4.add(value3);
          }
        }
        values2 = values4;
      },
      clear(): Dynamic {
        callback4();
        for (let value2 of values2 as Dynamic)
          try {
            (0, runtime.clearFindHighlights)(value2);
          } catch {}
        values2 = new Set();
        text = "";
        values3.clear();
        value = null;
        environment.keepRunning(null);
      },
      subscribe(input: Dynamic): Dynamic {
        values.add(input);
        return (): Dynamic => {
          values.delete(input);
        };
      },
      describe(source: Dynamic): Dynamic {
        let value2: Dynamic = environment.manifest(),
          value3: Dynamic =
            source.page === environment.pageId()
              ? ""
              : (value2.pages?.find(
                  (input?: Dynamic): Dynamic => input.id === source.page,
                )?.name ?? ""),
          value4: Dynamic =
            source.kind === "note"
              ? undefined
              : value2.artboards.find(
                  (input?: Dynamic): Dynamic => input.file === source.file,
                ),
          value5: Dynamic =
            source.kind === "note"
              ? (value2.annotations ?? []).find(
                  (input?: Dynamic): Dynamic => input.id === source.id,
                )
              : undefined,
          value6: Dynamic = value4
            ? (/^artboard\b/i.test(findArtboardTitle(value4))
                ? ""
                : "Artboard ") + findArtboardTitle(value4)
            : value5
              ? value5.kind === "title1"
                ? "Canvas text"
                : "Note"
              : undefined;
        return value6 === undefined
          ? undefined
          : value3 === ""
            ? value6
            : value3 + ", " + value6;
      },
      changed: callback5,
      frameBooted(input: Dynamic): Dynamic {
        for (let value2 of [...(entries.get(input) ?? [])] as Dynamic) value2();
        callback5();
      },
    };
  }
  function findRestoreCamera(camera?: Dynamic, glide?: Dynamic): Dynamic {
    return glide !== null && isCompatibleFindCameraGlide(camera, glide)
      ? glide.from
      : camera;
  }
  function isCompatibleFindCameraGlide(
    camera?: Dynamic,
    glide?: Dynamic,
  ): Dynamic {
    if (
      camera.scale !== glide.from.scale ||
      glide.to.scale !== glide.from.scale
    )
      return false;
    let value: Dynamic = glide.to.x - glide.from.x,
      value2: Dynamic = glide.to.y - glide.from.y,
      value3: Dynamic = camera.x - glide.from.x,
      value4: Dynamic = camera.y - glide.from.y,
      value5: Dynamic = Math.hypot(value, value2),
      value6: Dynamic = 0.5 / camera.scale,
      value7: Dynamic =
        value5 === 0
          ? Math.hypot(value3, value4)
          : Math.abs(value * value4 - value2 * value3) / value5,
      value8: Dynamic =
        value5 === 0 ? 0 : (value * value3 + value2 * value4) / value5;
    return value7 <= value6 && value8 >= -value6 && value8 <= value5 + value6;
  }
  function designFileTextRuns(file?: Dynamic, source?: Dynamic): Dynamic {
    if (source === undefined || (0, runtime.isLoadingArtboardHtml)(source))
      return null;
    let entry: Dynamic = cachedDesignTextRuns.get(file);
    if (entry?.src === source) return entry.runs;
    try {
      let value: Dynamic = (0, runtime.parseDcHtmlDocument)(source),
        value2: Dynamic = (
          value
            ? new runtime.DcEditorModel(value.template)
            : new runtime.DcEditorModel(source, {
                raw: true,
              })
        )
          .textRuns()
          .map(
            (input?: Dynamic): Dynamic =>
              (0, runtime.collapseFindWhitespace)(input).trim(),
          );
      cachedDesignTextRuns.delete(file);
      cachedDesignTextRuns.set(file, {
        src: source,
        runs: value2,
      });
      for (let value3 of cachedDesignTextRuns.keys() as Dynamic) {
        if (cachedDesignTextRuns.size <= textRunCacheLimit) break;
        cachedDesignTextRuns.delete(value3);
      }
      return value2;
    } catch {
      return null;
    }
  }
  bindRuntimeValue(runtime, "normalizedElementBox", () => normalizedElementBox);
  bindRuntimeValue(
    runtime,
    "findExcludedEditorSelector",
    () => findExcludedEditorSelector,
    (value) => {
      findExcludedEditorSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findFrameProbeTimeoutMs",
    () => findFrameProbeTimeoutMs,
    (value) => {
      findFrameProbeTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findFrameCaptureTimeoutMs",
    () => findFrameCaptureTimeoutMs,
    (value) => {
      findFrameCaptureTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findViewportRestoreTimeoutMs",
    () => findViewportRestoreTimeoutMs,
    (value) => {
      findViewportRestoreTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findViewportTransformTolerance",
    () => findViewportTransformTolerance,
    (value) => {
      findViewportTransformTolerance = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findArtboardTitle",
    () => findArtboardTitle,
    (value) => {
      findArtboardTitle = value;
    },
  );
  bindRuntimeValue(runtime, "annotationTextLines", () => annotationTextLines);
  bindRuntimeValue(
    runtime,
    "waitForFindReveal",
    () => waitForFindReveal,
    (value) => {
      waitForFindReveal = value;
    },
  );
  bindRuntimeValue(runtime, "canRevealFindMatch", () => canRevealFindMatch);
  bindRuntimeValue(
    runtime,
    "revealFindMatchAfterTextEdit",
    () => revealFindMatchAfterTextEdit,
  );
  bindRuntimeValue(
    runtime,
    "revealFindMatchAfterSettle",
    () => revealFindMatchAfterSettle,
  );
  bindRuntimeValue(
    runtime,
    "runFindRevealAfterSettle",
    () => runFindRevealAfterSettle,
  );
  bindRuntimeValue(
    runtime,
    "createCanvasFindAdapter",
    () => createCanvasFindAdapter,
  );
  bindRuntimeValue(runtime, "findRestoreCamera", () => findRestoreCamera);
  bindRuntimeValue(
    runtime,
    "isCompatibleFindCameraGlide",
    () => isCompatibleFindCameraGlide,
  );
  bindRuntimeValue(
    runtime,
    "textRunCacheLimit",
    () => textRunCacheLimit,
    (value) => {
      textRunCacheLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cachedDesignTextRuns",
    () => cachedDesignTextRuns,
    (value) => {
      cachedDesignTextRuns = value;
    },
  );
  bindRuntimeValue(runtime, "designFileTextRuns", () => designFileTextRuns);
  return () => {
    findExcludedEditorSelector =
      "[data-dc-editor-overlay],[data-dc-editor-overlay-root],[data-omelette-chrome],[data-omelette-injected],[data-dc-editor-drag-proxy],[data-dc-editor-copy-sink]";
    findFrameProbeTimeoutMs = 8e3;
    findFrameCaptureTimeoutMs = 3e3;
    findViewportRestoreTimeoutMs = 600;
    findViewportTransformTolerance = 8;
    findArtboardTitle = (input?: Dynamic): Dynamic =>
      input.title ?? input.file.replace(/\.dc\.html$/, "");
    waitForFindReveal = (input?: Dynamic): Dynamic =>
      new Promise((input2?: Dynamic): Dynamic => setTimeout(input2, input));
    textRunCacheLimit = 200;
    cachedDesignTextRuns = new Map();
  };
}
