/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCommentsCanvasController(
  runtime: RuntimeBindings,
): () => void {
  var jsx_mg: Dynamic;
  var commentAnchorRefreshIntervalMs: Dynamic;
  var commentPlacementInsetPixels: Dynamic;
  var commentRevealTimeoutMs: Dynamic;
  var canvasCommentScopeKey: Dynamic;
  var commentPointerStrokeInset: Dynamic;
  var commentPointerMovementThreshold: Dynamic;
  var commentClickMovementThresholdPixels: Dynamic;
  var maxCommentAreaElementLabels: Dynamic;
  var commentScopeKey: Dynamic;
  var commentRectsEqual: Dynamic;
  function useCanvasComments(options?: Dynamic): Dynamic {
    let {
        manifest: manifest,
        pageKey: pageKey,
        camera: camera,
        surfaceRef: surfaceRef,
        handlesRef: handlesRef,
        fullscreenFile: fullscreenFile,
        fullscreenFrame: fullscreenFrame,
        armedTool: armedTool,
      }: Dynamic = options,
      value: Dynamic = (0, runtime.react_mi.useRef)(options);
    value.current = options;
    let value2: Dynamic = (0, runtime.react_mi.useRef)(null),
      [value3, value4]: Dynamic = (0, runtime.react_mi.useState)(false),
      value5: Dynamic = (0, runtime.react_mi.useRef)(Number.NEGATIVE_INFINITY),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        new Proxy(input, {
          get(input2: Dynamic, options2: Dynamic): Dynamic {
            if (options2 === "compose")
              return (
                input3?: Dynamic,
                options3?: Dynamic,
                context?: Dynamic,
              ): Dynamic => (
                (value5.current = performance.now()),
                input2.compose(input3, options3, context)
              );
            let entry: Dynamic = Reflect.get(input2, options2, input2);
            return typeof entry == "function" ? entry.bind(input2) : entry;
          },
        }),
      [value6, value7]: Dynamic = (0, runtime.react_mi.useState)(false),
      value8: Dynamic = (0, runtime.useViewport)(value6, camera),
      value9: Dynamic = (0, runtime.react_mi.useRef)(value6);
    value9.current = value6;
    let [value10, value11]: Dynamic = (0, runtime.react_mi.useState)(false),
      [value12, value13]: Dynamic = (0, runtime.react_mi.useState)([]),
      value14: Dynamic = (0, runtime.react_mi.useRef)(value12);
    value14.current = value12;
    let value15: Dynamic = (0, runtime.react_mi.useRef)(new Map()),
      [, value16]: Dynamic = (0, runtime.react_mi.useState)(0),
      callback2: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value64: Dynamic = value15.current.get(input) ?? null;
        options2
          ? value15.current.set(input, options2)
          : value15.current.delete(input);
        commentRectsEqual(value64, options2) ||
          value16((input2?: Dynamic): Dynamic => input2 + 1);
      },
      [value17, value18]: Dynamic = (0, runtime.react_mi.useState)(new Map()),
      [value19, value20]: Dynamic = (0, runtime.react_mi.useState)(null),
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        value20(
          (input2?: Dynamic): Dynamic =>
            commentRectsEqual(input2, input) ? input2 : input,
        ),
      value21: Dynamic = (0, runtime.react_mi.useRef)(0),
      value22: Dynamic = (0, runtime.react_mi.useRef)(null),
      [value23, value24]: Dynamic = (0, runtime.react_mi.useState)(null),
      value25: Dynamic = (0, runtime.react_mi.useRef)("");
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      let flag: Dynamic = false;
      (0, runtime.bindCustomAnchors)({
        mode: (input?: Dynamic): Dynamic => {
          value7(input);
          value.current.onModeChange?.(input);
          value21.current += 1;
          value22.current = null;
          callback3(null);
          value25.current = "";
        },
        threads: (input?: Dynamic): Dynamic => {
          value25.current = "";
          value13(input);
          input.some((input2?: Dynamic): Dynamic => input2.active) &&
            value31.current.show(null);
        },
        composing: value11,
        move: (input?: Dynamic, options2?: Dynamic): Dynamic =>
          value38.current(input, options2),
        hotkey: true,
        reveal: (input?: Dynamic): Dynamic => {
          let value64: Dynamic = value14.current.find(
              (input2?: Dynamic): Dynamic => input2.id === input,
            ),
            value65: Dynamic = value64
              ? (0, runtime.parseDesignCommentAnchor)(value64.anchor)
              : null;
          if (!value65) return;
          let value66: Dynamic =
            value65.kind === "el" ||
            value65.kind === "artboard" ||
            value65.kind === "area"
              ? {
                  kind: "artboard",
                  match: (input2?: Dynamic): Dynamic =>
                    (0, runtime.stableAnchorHash)(input2) === value65.fileHash,
                }
              : value65.kind === "note" || value65.kind === "notearea"
                ? {
                    kind: "note",
                    match: (input2?: Dynamic): Dynamic =>
                      (0, runtime.stableAnchorHash)(input2) === value65.idHash,
                  }
                : value65.kind === "boards"
                  ? {
                      kind: "artboard",
                      match: (input2?: Dynamic): Dynamic =>
                        value65.boards.some(
                          (input3?: Dynamic): Dynamic =>
                            input3.fileHash ===
                            (0, runtime.stableAnchorHash)(input2),
                        ),
                      boards: true,
                    }
                  : {
                      kind: "page",
                      match: (input2?: Dynamic): Dynamic =>
                        (0, runtime.stableAnchorHash)(input2) ===
                        value65.pageHash,
                    };
          value.current.onReveal?.(value66) !== false && value24(input);
        },
      }).then((input?: Dynamic): Dynamic => {
        if (flag) {
          input?.release();
          return;
        }
        value2.current = input;
        value4(input != null);
        value.current.onController?.(input && callback(input));
      });
      return (): Dynamic => {
        flag = true;
        value2.current?.release();
        value2.current = null;
        value.current.onController?.(null);
      };
    }, []);
    let callback4: Dynamic = (): Dynamic => {
      let current: Dynamic = value2.current;
      typeof current?.exitMode == "function" && current.exitMode();
    };
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      if (!value6) return;
      let callback38: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.button !== 0) return;
        let value64: Dynamic =
          event.target instanceof Element ? event.target : null;
        value64?.closest(
          '[data-mega-chrome="comments"],[data-view-control],[data-mc-scrim]',
        ) ||
          (value64?.closest(runtime.blockingOverlaySelector) &&
            (document as Dynamic).querySelector(
              '[data-view-control] [aria-expanded="true"]',
            )) ||
          callback4();
      };
      (document as Dynamic).addEventListener("pointerdown", callback38, true);
      return (): Dynamic =>
        (document as Dynamic).removeEventListener(
          "pointerdown",
          callback38,
          true,
        );
    }, [value6]);
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      value6 && armedTool != null && armedTool !== "select" && callback4();
    }, [armedTool]);
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      if (!value3) return;
      let callback38: Dynamic = (): Dynamic => {
          let current: Dynamic = value2.current;
          return typeof current?.enterMode != "function" ||
            value.current.keyHeld ||
            (0, runtime.hasBlockingEditorOverlay)()
            ? false
            : (value9.current ? current.exitMode?.() : current.enterMode(),
              true);
        },
        callback39: Dynamic = (event?: Dynamic): Dynamic => {
          (event.key !== "c" && event.key !== "C") ||
            event.shiftKey ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.defaultPrevented ||
            event.repeat ||
            event.isComposing ||
            (0, runtime.isEditingInputTarget)(event.target) ||
            (0, runtime.shouldKeepLocalKeyboardEvent)(event) ||
            (event.target instanceof Element &&
              event.target.closest("[data-mega-selection-strip]") !== null) ||
            (callback38() && event.preventDefault());
        },
        callback40: Dynamic = (): Dynamic => {
          callback38();
        };
      (window as Dynamic).addEventListener("keydown", callback39);
      (window as Dynamic).addEventListener("canvas-comment-key", callback40);
      return (): Dynamic => {
        (window as Dynamic).removeEventListener("keydown", callback39);
        (window as Dynamic).removeEventListener(
          "canvas-comment-key",
          callback40,
        );
      };
    }, [value3]);
    let callback5: Dynamic = (input?: Dynamic): Dynamic =>
        manifest.artboards.find(
          (input2?: Dynamic): Dynamic => input2.file === input,
        ) ?? null,
      callback6: Dynamic = (input?: Dynamic): Dynamic =>
        manifest.artboards.find(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.stableAnchorHash)(input2.file) === input,
        )?.file ?? null,
      value26: Dynamic = (0, runtime.react_mi.useRef)(callback6);
    value26.current = callback6;
    let callback7: Dynamic = (input?: Dynamic): Dynamic =>
        (manifest.annotations ?? []).find(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.stableAnchorHash)(input2.id) === input,
        ) ?? null,
      callback8: Dynamic = (input?: Dynamic): Dynamic =>
        (manifest.annotations ?? []).find(
          (input2?: Dynamic): Dynamic => input2.id === input,
        ) ?? null,
      callback9: Dynamic = (input?: Dynamic): Dynamic =>
        fullscreenFile == null || fullscreenFile === input,
      callback10: Dynamic = (input?: Dynamic): Dynamic =>
        input.file === fullscreenFile && fullscreenFrame
          ? fullscreenFrame
          : {
              x: input.x,
              y: input.y,
              w: input.w,
              h: input.h,
            };
    (0, runtime.react_mi.useLayoutEffect)(
      (): Dynamic => (): Dynamic =>
        [...value15.current.keys()].forEach(
          (input?: Dynamic): Dynamic => callback2(input, null),
        ),
      [value6, fullscreenFile],
    );
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      if (!value6) return;
      let flag: Dynamic = false,
        value64: Dynamic,
        callback38: Dynamic = async (): Promise<Dynamic> => {
          let entries: Dynamic = new Map();
          fullscreenFile != null && entries.set(fullscreenFile, new Map());
          for (let value65 of value14.current as Dynamic) {
            let value66: Dynamic = (0, runtime.parseDesignCommentAnchor)(
                value65.anchor,
              ),
              value67: Dynamic =
                value66?.kind === "artboard" && "px" in value66;
            if (
              !value66 ||
              !(
                value66.kind === "el" ||
                (value66.kind === "area" && value66.path != null) ||
                value67
              )
            )
              continue;
            let value68: Dynamic = value26.current(value66.fileHash);
            if (value68 == null) continue;
            if (value67) {
              entries.has(value68) || entries.set(value68, new Map());
              continue;
            }
            let entry: Dynamic = entries.get(value68);
            entry || entries.set(value68, (entry = new Map()));
            entry.set(commentScopeKey(value66.path, value66.tid, value66.fp), {
              path: value66.path,
              tid: value66.tid,
              fp: value66.fp,
            });
          }
          let entries2: Dynamic = new Map();
          await Promise.all(
            [...entries].map(
              async ([input, input2]: Dynamic): Promise<Dynamic> => {
                let entry: Dynamic =
                    value.current.handlesRef.current.get(input),
                  value65: Dynamic =
                    entry?.isReady() && !entry.isBlocked()
                      ? (0, runtime.createPreviewHandle)(
                          entry.webviewRef.current,
                        )
                      : null,
                  items: Dynamic = [...input2.values()],
                  value66: Dynamic = value65
                    ? await (0, runtime.pickerCommentRects)(value65, [
                        {
                          page: true,
                        },
                        ...items,
                      ])
                    : null;
                value66 &&
                  entries2.set(
                    input,
                    new Map(
                      items.map(
                        (input3?: Dynamic, options2?: Dynamic): Dynamic => [
                          commentScopeKey(input3.path, input3.tid, input3.fp),
                          value66[options2 + 1] ?? null,
                        ],
                      ),
                    ),
                  );
                flag || callback2(input, value66?.[0] ?? null);
              },
            ),
          );
          !flag &&
            ([...value15.current.keys()]
              .filter((input?: Dynamic): Dynamic => !entries.has(input))
              .forEach((input?: Dynamic): Dynamic => callback2(input, null)),
            value18(
              (input?: Dynamic): Dynamic => new Map([...input, ...entries2]),
            ),
            (value64 = setTimeout((): Dynamic => {
              callback38();
            }, commentAnchorRefreshIntervalMs)));
        };
      callback38();
      return (): Dynamic => {
        flag = true;
        clearTimeout(value64);
      };
    }, [value6, value12, fullscreenFile]);
    let callback11: Dynamic = (source?: Dynamic): Dynamic => {
        if (source.kind === "notearea") {
          let value67: Dynamic =
            fullscreenFile == null ? callback7(source.idHash) : null;
          return value67
            ? (0, runtime.rotatedAnnotationBounds)(
                value67,
                (0, runtime.objectCommentAreaRect)(
                  value67,
                  options.annBox(value67),
                  source.box,
                ),
              )
            : null;
        }
        if (source.kind === "boards") {
          if (fullscreenFile != null) return null;
          let value67: Dynamic = source.boards.flatMap(
              (input?: Dynamic): Dynamic => {
                let value69: Dynamic = callback6(input.fileHash),
                  value70: Dynamic =
                    value69 == null ? null : callback5(value69);
                return value70
                  ? [
                      {
                        x: value70.x,
                        y: value70.y,
                        w: value70.w,
                        h: value70.h,
                      },
                    ]
                  : [];
              },
            ),
            value68: Dynamic = (0, runtime.unionCommentRects)(value67);
          return value68
            ? (0, runtime.denormalizeCommentArea)(value68, source.box)
            : null;
        }
        if (source.kind !== "area") return null;
        let value64: Dynamic = callback6(source.fileHash),
          value65: Dynamic = value64 == null ? null : callback5(value64);
        if (!value65 || value64 == null || !callback9(value64)) return null;
        if (source.path == null)
          return (0, runtime.denormalizeCommentArea)(
            callback10(value65),
            source.box,
          );
        let value66: Dynamic = value17
          .get(value64)
          ?.get(commentScopeKey(source.path, source.tid, source.fp));
        if (value66 !== undefined)
          return value66 === null
            ? null
            : callback16(
                value64,
                (0, runtime.denormalizeCommentArea)(value66, source.box),
              );
      },
      callback12: Dynamic = (source?: Dynamic): Dynamic => {
        if (source.kind === "canvas") {
          let value70: Dynamic = manifest.pages?.[0]?.id ?? "",
            value71: Dynamic = (0, runtime.isCanvasPageMatch)(
              (input?: Dynamic): Dynamic =>
                source.pageHash === (0, runtime.stableAnchorHash)(input),
              pageKey === "" ? value70 : pageKey,
              value70,
            );
          return fullscreenFile == null && value71
            ? {
                x: source.x,
                y: source.y,
              }
            : null;
        }
        if (source.kind === "note") {
          if (fullscreenFile != null) return null;
          let value70: Dynamic = callback7(source.idHash);
          if (!value70) return null;
          if (source.fx != null && source.fy != null)
            return (0, runtime.objectCommentPoint)(
              value70,
              options.annBox(value70),
              {
                fx: source.fx,
                fy: source.fy,
              },
            );
          let value71: Dynamic = (0, runtime.rotatedAnnotationBounds)(
            value70,
            options.annBox(value70),
          );
          return {
            x: value71.x + value71.w / 2,
            y: value71.y + 12,
          };
        }
        if (source.kind === "notearea") {
          let value70: Dynamic =
            fullscreenFile == null ? callback7(source.idHash) : null;
          return value70
            ? (0, runtime.objectCommentAreaHandlePoint)(
                value70,
                options.annBox(value70),
                source.box,
              )
            : null;
        }
        if (source.kind === "area" || source.kind === "boards") {
          let value70: Dynamic = callback11(source);
          if (value70)
            return (0, runtime.commentAreaHandlePoint)(
              value70,
              source.box.corner,
            );
          if (value70 === null && source.kind === "area") return null;
          let value71: Dynamic =
            source.kind === "area"
              ? [source.fileHash]
              : source.boards.map((input?: Dynamic): Dynamic => input.fileHash);
          for (let value72 of value71 as Dynamic) {
            let value73: Dynamic = callback6(value72),
              value74: Dynamic = value73 == null ? null : callback5(value73);
            if (!value74 || !callback9(value74.file)) continue;
            let value75: Dynamic = callback10(value74);
            return {
              x: value75.x + value75.w / 2,
              y: value75.y + value75.h / 2,
            };
          }
          return null;
        }
        let value64: Dynamic = callback6(source.fileHash),
          value65: Dynamic = value64 == null ? null : callback5(value64);
        if (!value65 || value64 == null || !callback9(value64)) return null;
        let value66: Dynamic = callback10(value65);
        if (source.kind === "artboard" && !("px" in source))
          return {
            x: value66.x + source.fx * value66.w,
            y: value66.y + source.fy * value66.h,
          };
        if (source.kind === "artboard") {
          let entry: Dynamic = value15.current.get(value64);
          if (!entry && value64 === fullscreenFile)
            return {
              x: value66.x + value66.w / 2,
              y: value66.y + value66.h / 2,
            };
          let value70: Dynamic =
              (entry?.x ?? 0) +
              (entry
                ? Math.min(
                    source.px,
                    Math.max(0, entry.w - commentPlacementInsetPixels),
                  )
                : source.px),
            value71: Dynamic =
              (entry?.y ?? 0) +
              (entry
                ? Math.min(
                    source.py,
                    Math.max(0, entry.h - commentPlacementInsetPixels),
                  )
                : source.py);
          return value70 < 0 ||
            value71 < 0 ||
            value70 > value66.w ||
            value71 > value66.h
            ? null
            : {
                x: value66.x + value70,
                y: value66.y + value71,
              };
        }
        let value67: Dynamic = value17
          .get(value64)
          ?.get(commentScopeKey(source.path, source.tid, source.fp));
        if (value67 === undefined)
          return {
            x: value66.x + value66.w / 2,
            y: value66.y + value66.h / 2,
          };
        if (value67 === null) return null;
        let value68: Dynamic = value67.x + source.fx * value67.w,
          value69: Dynamic = value67.y + source.fy * value67.h;
        return value68 < 0 ||
          value69 < 0 ||
          value68 > value66.w ||
          value69 > value66.h
          ? null
          : {
              x: value66.x + value68,
              y: value66.y + value69,
            };
      },
      callback13: Dynamic = (input?: Dynamic): Dynamic => ({
        x: (input.x - value8.x) * value8.scale,
        y: (input.y - value8.y) * value8.scale,
      });
    (0, runtime.react_mi.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value2.current,
        current2: Dynamic = surfaceRef.current;
      if (!value6 || !current || !current2) return;
      let bounds: Dynamic = current2.getBoundingClientRect(),
        value64: Dynamic = (0, runtime.toolbarOverlayHeight)(current2),
        state: Dynamic = {};
      for (let value66 of value12 as Dynamic) {
        let value67: Dynamic = (0, runtime.parseDesignCommentAnchor)(
            value66.anchor,
          ),
          value68: Dynamic = value67 ? callback12(value67) : null;
        if (!value68) continue;
        let value69: Dynamic = callback13(value68),
          innerWidth: Dynamic = (window as Dynamic).innerWidth,
          innerHeight: Dynamic = (window as Dynamic).innerHeight,
          value70: Dynamic =
            value69.x < 0
              ? value69.x - innerWidth
              : value69.x > bounds.width
                ? value69.x + innerWidth
                : bounds.left + value69.x,
          value71: Dynamic =
            value69.y < value64
              ? value69.y - innerHeight
              : value69.y > bounds.height
                ? value69.y + innerHeight
                : bounds.top + value69.y;
        state[value66.id] = {
          x: Math.round(value70 + (window as Dynamic).scrollX),
          y: Math.round(value71 + (window as Dynamic).scrollY),
        };
      }
      let value65: Dynamic = JSON.stringify(state);
      value65 !== value25.current &&
        ((value25.current = value65), current.placed(state));
    });
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      if (value23 == null) return;
      let value64: Dynamic = value12.find(
          (input?: Dynamic): Dynamic => input.id === value23,
        ),
        value65: Dynamic = value64
          ? (0, runtime.parseDesignCommentAnchor)(value64.anchor)
          : null,
        current: Dynamic = surfaceRef.current;
      if (!value65 || !current) {
        value24(null);
        return;
      }
      let value66: Dynamic = callback12(value65);
      if (
        !value66 &&
        (value65.kind === "el" ||
          value65.kind === "artboard" ||
          value65.kind === "area" ||
          value65.kind === "boards")
      ) {
        let value71: Dynamic = callback6(
            value65.kind === "boards"
              ? (value65.boards[0]?.fileHash ?? "")
              : value65.fileHash,
          ),
          value72: Dynamic = value71 == null ? null : callback5(value71);
        value72 &&
          (value66 = {
            x: value72.x + value72.w / 2,
            y: value72.y + value72.h / 2,
          });
      }
      if (!value66 || (value24(null), fullscreenFile != null)) return;
      let value67: Dynamic = (0, runtime.toolbarOverlayHeight)(current),
        value68: Dynamic = current.clientWidth || 1,
        value69: Dynamic = (current.clientHeight || 1) - value67,
        value70: Dynamic = Math.max(camera.get().scale, 0.5);
      camera.set(
        {
          x: value66.x - value68 / (2 * value70),
          y: value66.y - (value67 + value69 / 2) / value70,
          scale: value70,
        },
        true,
      );
    }, [value23, value12, manifest, value17, fullscreenFile, pageKey, camera]);
    let callback14: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let current: Dynamic = surfaceRef.current;
        if (!current) return null;
        let bounds: Dynamic = current.getBoundingClientRect(),
          value64: Dynamic = value8.x + (input - bounds.left) / value8.scale,
          value65: Dynamic = value8.y + (options2 - bounds.top) / value8.scale;
        for (let value66 of (document as Dynamic).elementsFromPoint(
          input,
          options2,
        ) as Dynamic) {
          if (value66.closest('[data-mega-chrome="comments"]')) continue;
          if (!current.contains(value66)) return null;
          let ancestor: Dynamic = value66.closest("[data-mega-annotation]");
          if (ancestor)
            return {
              kind: "note",
              id: ancestor.getAttribute("data-mega-annotation") ?? "",
              el: ancestor,
              x: value64,
              y: value65,
            };
          let ancestor2: Dynamic = value66.closest("[data-mega-artboard]");
          if (ancestor2) {
            let value67: Dynamic =
                ancestor2.getAttribute("data-mega-artboard") ?? "",
              value68: Dynamic = callback5(value67);
            if (!value68) return null;
            let value69: Dynamic = callback10(value68),
              value70: Dynamic = value64 - value69.x,
              value71: Dynamic = value65 - value69.y,
              value72: Dynamic =
                value70 >= 0 &&
                value71 >= 0 &&
                value70 <= value69.w &&
                value71 <= value69.h,
              entry: Dynamic = handlesRef.current.get(value67);
            return value72
              ? {
                  kind:
                    entry?.isReady() && !entry.isBlocked() ? "face" : "offFace",
                  file: value67,
                  lx: value70,
                  ly: value71,
                }
              : {
                  kind: "artboard",
                  file: value67,
                  fx: Math.min(1, Math.max(0, value70 / (value69.w || 1))),
                  fy: 0,
                };
          }
          if (value66 === current || value66.parentElement === current)
            return fullscreenFile == null
              ? {
                  kind: "canvas",
                  x: value64,
                  y: value65,
                }
              : null;
        }
        return null;
      },
      callback15: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value64?: Dynamic,
      ): Promise<Dynamic> => {
        let entry: Dynamic = handlesRef.current.get(input),
          value65: Dynamic = entry
            ? (0, runtime.createPreviewHandle)(entry.webviewRef.current)
            : null;
        return value65
          ? (0, runtime.pickerCommentAt)(value65, options2, context, value64)
          : null;
      },
      callback16: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value64: Dynamic = callback5(input);
        if (!value64) return null;
        let value65: Dynamic = callback10(value64),
          value66: Dynamic = Math.max(0, options2.x),
          value67: Dynamic = Math.max(0, options2.y),
          value68: Dynamic = Math.min(value65.w, options2.x + options2.w),
          value69: Dynamic = Math.min(value65.h, options2.y + options2.h);
        return value68 <= value66 || value69 <= value67
          ? null
          : {
              x: value65.x + value66,
              y: value65.y + value67,
              w: value68 - value66,
              h: value69 - value67,
            };
      },
      value27: Dynamic = (0, runtime.react_mi.useRef)({
        busy: false,
        next: null,
      }),
      callback17: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value64: Dynamic = callback14(input, options2);
        value64?.kind !== "face" &&
          ((value21.current += 1), (value27.current.next = null));
        if (!value64 || value64.kind === "canvas") return callback3(null);
        if (value64.kind === "note") {
          let bounds: Dynamic = surfaceRef.current.getBoundingClientRect(),
            bounds2: Dynamic = value64.el.getBoundingClientRect();
          return callback3({
            x: value8.x + (bounds2.left - bounds.left) / value8.scale,
            y: value8.y + (bounds2.top - bounds.top) / value8.scale,
            w: bounds2.width / value8.scale,
            h: bounds2.height / value8.scale,
          });
        }
        if (value64.kind === "artboard" || value64.kind === "offFace") {
          let value65: Dynamic = callback10(callback5(value64.file));
          return callback3(
            callback16(value64.file, {
              x: 0,
              y: 0,
              w: value65.w,
              h: value65.h,
            }),
          );
        }
        let current: Dynamic = value21.current,
          callback38: Dynamic = (): Dynamic => {
            value27.current.busy = true;
            callback15(value64.file, value64.lx, value64.ly, 600).then(
              (input2?: Dynamic): Dynamic => {
                value27.current.busy = false;
                let next: Dynamic = value27.current.next;
                value27.current.next = null;
                next
                  ? next()
                  : current === value21.current &&
                    callback3(
                      input2 && input2.path != null
                        ? callback16(value64.file, input2.rect)
                        : null,
                    );
              },
            );
          };
        value27.current.busy
          ? (value27.current.next = callback38)
          : callback38();
      },
      value28: Dynamic = (0, runtime.react_mi.useRef)(callback17);
    value28.current = callback17;
    let callback18: Dynamic = (input?: Dynamic): Dynamic => {
      value22.current = {
        x: input.clientX,
        y: input.clientY,
      };
      value34.drawing() || callback17(input.clientX, input.clientY);
    };
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      let current: Dynamic = value22.current;
      value6 && current && callback17(current.x, current.y);
    }, [value8.x, value8.y, value8.scale]);
    let callback19: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
        context: Dynamic = 3e3,
      ): Promise<Dynamic> => {
        let value64: Dynamic = callback14(input, options2);
        if (!value64) return null;
        if (value64.kind === "canvas")
          return {
            anchor: {
              kind: "canvas",
              page: pageKey,
              x: value64.x,
              y: value64.y,
            },
            label: (0, runtime.commentAnchorShortLabel)({
              kind: "canvas",
              pages: manifest.pages,
              pageKey: pageKey,
            }),
            detail: (0, runtime.commentCanvasPointDetail)(value64.x, value64.y),
          };
        if (value64.kind === "note") {
          let value70: Dynamic = callback8(value64.id),
            value71: Dynamic = value70 ?? {
              text: "",
            },
            value72: Dynamic = value70
              ? (0, runtime.normalizeObjectCommentPoint)(
                  value70,
                  options.annBox(value70),
                  value64,
                )
              : undefined;
          return {
            anchor: {
              kind: "note",
              id: value64.id,
              ...value72,
            },
            label: (0, runtime.commentAnchorShortLabel)({
              kind: "note",
              note: value71,
            }),
            detail: (0, runtime.commentObjectPointDetail)(value71, value72),
          };
        }
        let value65: Dynamic = callback5(value64.file);
        if (!value65) return null;
        let value66: Dynamic = (0, runtime.commentAnchorShortLabel)({
          kind: "artboard",
          board: value65,
        });
        if (value64.kind === "artboard")
          return {
            anchor: value64,
            label: value66,
            detail: (0, runtime.commentArtboardElementDetail)(value65),
          };
        let value67: Dynamic = callback10(value65),
          callback38: Dynamic = (input2?: Dynamic): Dynamic => ({
            anchor: input2
              ? {
                  kind: "artboard",
                  file: value64.file,
                  px: value64.lx - input2.x,
                  py: value64.ly - input2.y,
                }
              : {
                  kind: "artboard",
                  file: value64.file,
                  fx: Math.min(1, Math.max(0, value64.lx / (value67.w || 1))),
                  fy: Math.min(1, Math.max(0, value64.ly / (value67.h || 1))),
                },
            label: value66,
            detail: (0, runtime.commentArtboardElementDetail)(value65),
          });
        if (value64.kind === "offFace")
          return callback38(
            handlesRef.current.get(value64.file)?.webviewRef.current
              ? null
              : {
                  x: 0,
                  y: 0,
                },
          );
        let value68: Dynamic = await callback15(
          value64.file,
          value64.lx,
          value64.ly,
          context,
        );
        value68?.page && callback2(value64.file, value68.page);
        if (!value68 || value68.path == null)
          return callback38(value68?.page ?? null);
        let state: Dynamic = {
          kind: "el",
          file: value64.file,
          path: value68.path,
          tid: value68.tid,
          fp: value68.fp,
          fx: value68.fx,
          fy: value68.fy,
        };
        if (!(0, runtime.serializeDesignCommentAnchor)(state))
          return callback38(value68.page ?? null);
        let entry: Dynamic = handlesRef.current.get(value64.file),
          value69: Dynamic = (0, runtime.describeCommentElement)(
            entry,
            value68,
          );
        return {
          anchor: state,
          label: (0, runtime.commentAnchorShortLabel)({
            kind: "el",
            board: value65,
            el: value69,
          }),
          detail: (0, runtime.commentArtboardElementDetail)(
            value65,
            callback21(entry, value68.tid, value69),
          ),
        };
      },
      callback20: Dynamic = (input?: Dynamic): Dynamic => {
        value29.current.cancel();
        let current: Dynamic = value2.current;
        if (!current || !value6) return;
        let state: Dynamic = {
          x: input.clientX + (window as Dynamic).scrollX,
          y: input.clientY + (window as Dynamic).scrollY,
        };
        callback19(input.clientX, input.clientY).then(
          (input2?: Dynamic): Dynamic => {
            let value64: Dynamic = input2
              ? (0, runtime.serializeDesignCommentAnchor)(input2.anchor)
              : null;
            value64 &&
              current
                .compose(value64, state, {
                  label: input2.label,
                  ...(input2.detail
                    ? {
                        detail: input2.detail,
                      }
                    : {}),
                })
                .then(
                  (input3?: Dynamic): Dynamic => {
                    input3.opened && value30.clear();
                  },
                  (): Dynamic => {},
                );
          },
          (): Dynamic => {},
        );
      },
      callback21: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value64: Dynamic =
          options2 != null ? input?.viewEntries([options2])[0] : undefined;
        return value64
          ? {
              path: value64.path,
              kind: context?.kind ?? value64.kind,
              text: context?.text ?? value64.words(),
            }
          : null;
      },
      value29: Dynamic = (0, runtime.react_mi.useRef)(
        (0, runtime.createCommentOperationToken)(),
      ),
      value30: Dynamic = (0, runtime.usePendingCommentArea)(
        value10,
        pageKey +
          `
` +
          (fullscreenFile ?? ""),
      ),
      value31: Dynamic = (0, runtime.react_mi.useRef)(value30);
    value31.current = value30;
    let { drawn: value32 }: Dynamic = value30,
      value33: Dynamic = (0, runtime.react_mi.useRef)(null),
      callback22: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value64: Dynamic = surfaceRef.current?.getBoundingClientRect(),
          entry: Dynamic = camera.get();
        return value64
          ? {
              x: entry.x + (input - value64.left) / entry.scale,
              y: entry.y + (options2 - value64.top) / entry.scale,
            }
          : null;
      },
      callback23: Dynamic = (input?: Dynamic): Dynamic => {
        let value64: Dynamic = surfaceRef.current?.getBoundingClientRect(),
          entry: Dynamic = camera.get();
        return value64
          ? {
              x: value64.left + (input.x - entry.x) * entry.scale,
              y: value64.top + (input.y - entry.y) * entry.scale,
            }
          : null;
      },
      value34: Dynamic = (0, runtime.useCommentAreaMarquee)({
        toLocal: callback22,
        toClient: callback23,
        stage: (): Dynamic => surfaceRef.current,
        slopPx: 10,
        onClick: (input?: Dynamic): Dynamic =>
          value37.current({
            clientX: input.clientX,
            clientY: input.clientY,
          }),
        onNothing: (): Dynamic => value30.restore(),
        onLive: (): Dynamic => value30.show(null),
        onArea: ({
          c0: c02,
          c1: c12,
          at: at,
          resizing: resizing,
        }: Dynamic): Dynamic => {
          let state: Dynamic = {
              x: Math.min(c02.x, c12.x),
              y: Math.min(c02.y, c12.y),
              w: Math.abs(c12.x - c02.x),
              h: Math.abs(c12.y - c02.y),
            },
            value64: Dynamic = resizing ? c12 : c02,
            state2: Dynamic = {
              ...state,
              ox: value64.x,
              oy: value64.y,
            };
          value30.show(state2);
          value36.current(
            state2,
            {
              x: at.x + (window as Dynamic).scrollX,
              y: at.y + (window as Dynamic).scrollY,
            },
            (0, runtime.nearestCommentAreaCorner)(state, resizing ? c02 : c12),
            value29.current.begin(),
          );
        },
      }),
      { marquee: value35 }: Dynamic = value34;
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      value34.cancel();
      value29.current.cancel();
      value6 || value30.clear();
    }, [value6, pageKey, fullscreenFile]);
    let callback24: Dynamic = (
        event?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let current: Dynamic = value2.current,
          current2: Dynamic = value33.current;
        return !current ||
          !current2 ||
          event.button !== 0 ||
          options.spaceHeld ||
          (0, runtime.prefersDragGesture)(event, !!current.areas)
          ? false
          : (callback3(null),
            (value21.current += 1),
            value34.start(event.nativeEvent, current2, options2));
      },
      callback25: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value64?: Dynamic,
      ): Promise<Dynamic> => {
        let current: Dynamic = value2.current;
        if (!current || !value6) return;
        let callback38: Dynamic = (): Dynamic =>
            value2.current === current && value9.current && value64.live,
          value65: Dynamic =
            pageKey +
            `
` +
            (fullscreenFile ?? ""),
          callback39: Dynamic = (): Dynamic => {
            value64.live && value30.restore();
          },
          flag: Dynamic = false,
          value66: Dynamic = await callback26(input, context, (): Dynamic => {
            flag = true;
            value30.show(null);
          });
        if (!value66 && flag) return;
        let value67: Dynamic = value66
          ? (0, runtime.serializeDesignCommentAnchor)(value66.anchor)
          : null;
        if (!value66 || !value67 || !callback38()) return callback39();
        current
          .compose(value67, options2, {
            label: value66.label,
            ...(value66.detail
              ? {
                  detail: value66.detail,
                }
              : {}),
            area: true,
          })
          .then((input2?: Dynamic): Dynamic => {
            if (!input2.opened) return callback39();
            value64.live && value30.hold(input, value65);
          }, callback39);
      },
      callback26: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value64: Dynamic = 3e3,
      ): Promise<Dynamic> => {
        let value65: Dynamic = manifest.artboards
            .filter((input2?: Dynamic): Dynamic => callback9(input2.file))
            .map(
              (input2?: Dynamic): Dynamic => ({
                board: input2,
                frame: callback10(input2),
              }),
            ),
          value66: Dynamic = (0, runtime.artboardsCoveredByCommentArea)(
            input,
            value65,
            7,
          ),
          value67: Dynamic = value66.length > 0,
          callback38: Dynamic = (input2?: Dynamic): Dynamic =>
            options.annUnder?.(input2) === true,
          value68: Dynamic =
            fullscreenFile != null ? [] : (manifest.annotations ?? []),
          value69: Dynamic = [
            ...value68.filter(callback38),
            ...value68.filter(
              (input2?: Dynamic): Dynamic => !callback38(input2),
            ),
          ]
            .filter(
              (source?: Dynamic): Dynamic =>
                source.kind !== "line" &&
                source.kind !== "arrow" &&
                !(value67 && callback38(source)),
            )
            .map(
              (source?: Dynamic): Dynamic => ({
                object: source,
                bounds: (0, runtime.rotatedAnnotationBounds)(
                  source,
                  options.annBox(source),
                ),
                solid: source.kind !== "pen",
                hides: source.kind === "image" || source.kind === undefined,
                on: (input2?: Dynamic): Dynamic =>
                  (0, runtime.pointWithinCommentObject)(
                    source,
                    options.annBox(source),
                    input2,
                  ),
              }),
            );
        for (let value73 of (0, runtime.objectsCoveredByCommentArea)(
          input,
          value69,
          value67,
        ) as Dynamic) {
          let value74: Dynamic = (0, runtime.normalizeObjectCommentArea)(
              value73,
              options.annBox(value73),
              input,
              options2,
            ),
            value75: Dynamic = (0, runtime.normalizeCommentArea)(
              input,
              (0, runtime.rotatedAnnotationBounds)(
                value73,
                options.annBox(value73),
              ),
            );
          if (value74)
            return {
              anchor: {
                kind: "notearea",
                id: value73.id,
                box: value74,
              },
              label: (0, runtime.commentObjectAreaShortLabel)(value73, value75),
              detail: (0, runtime.commentObjectAreaDetail)(value73, value74),
            };
        }
        if (value66.length === 0) {
          context?.();
          if (fullscreenFile != null) return null;
          let value73: Dynamic = input.x + input.w / 2,
            value74: Dynamic = input.y + input.h / 2;
          return {
            anchor: {
              kind: "canvas",
              page: pageKey,
              x: value73,
              y: value74,
            },
            label: (0, runtime.commentAnchorShortLabel)({
              kind: "canvas",
              pages: manifest.pages,
              pageKey: pageKey,
            }),
            detail: (0, runtime.commentCanvasPointDetail)(value73, value74),
          };
        }
        let callback39: Dynamic = async (
            input2?: Dynamic,
          ): Promise<Dynamic> => {
            let entry: Dynamic = handlesRef.current.get(input2.board.file),
              value73: Dynamic =
                entry?.isReady() && !entry.isBlocked()
                  ? (0, runtime.createPreviewHandle)(entry.webviewRef.current)
                  : null;
            if (!value73) return null;
            let value74: Dynamic = input2.inter.x - input2.frame.x,
              value75: Dynamic = input2.inter.y - input2.frame.y;
            return (0, runtime.pickerCommentIn)(
              value73,
              value74,
              value75,
              value74 + input2.inter.w,
              value75 + input2.inter.h,
              value64,
            );
          },
          callback40: Dynamic = (
            input2?: Dynamic,
            options3?: Dynamic,
          ): Dynamic => {
            if (!options3) return {};
            let entry: Dynamic = handlesRef.current.get(input2.board.file),
              items: Dynamic = [];
            for (let value73 of options3.covered as Dynamic) {
              let value74: Dynamic = entry?.viewEntries([value73.tid])[0];
              value74 &&
                value74.path.startsWith(String(value73.tid) + ":") &&
                items.push({
                  path: value74.path,
                  kind: value74.kind,
                  text: value74.words(),
                });
            }
            return {
              els: items.slice(0, maxCommentAreaElementLabels),
              total: Math.max(
                items.length,
                options3.total - (options3.covered.length - items.length),
              ),
            };
          };
        if (value66.length === 1) {
          let value73: Dynamic = value66[0],
            value74: Dynamic =
              value73.cov >= 0.85 ? null : await callback39(value73),
            value75: Dynamic = value74?.enclosing,
            state: Dynamic = {
              kind: "area",
              file: value73.board.file,
              path: null,
              tid: null,
              box: {
                ...value73.b,
                ...(options2 != null
                  ? {
                      corner: options2,
                    }
                  : {}),
              },
            };
          if (value75 && value75.path != null) {
            let value76: Dynamic = (0,
              runtime.commentAreaWithinArtboardContent)(value73, value75.rect),
              value77: Dynamic = value76 && {
                kind: "area",
                file: value73.board.file,
                path: value75.path,
                tid: value75.tid,
                fp: value75.fp,
                box: {
                  ...value76,
                  ...(options2 != null
                    ? {
                        corner: options2,
                      }
                    : {}),
                },
              };
            value77 &&
              (0, runtime.serializeDesignCommentAnchor)(value77) &&
              (state = value77);
          }
          let state2: Dynamic = {
            board: value73.board,
            cov: value73.cov,
            part: (0, runtime.describeCommentAreaLocation)(
              value73.b,
              value73.cov,
            ),
            ...callback40(value73, value74),
          };
          return {
            anchor: state,
            label: (0, runtime.commentArtboardAreaShortLabel)([state2]),
            detail: (0, runtime.commentArtboardAreaDetail)([state2]),
          };
        }
        let value70: Dynamic = await Promise.all(
            value66.map(
              (input2?: Dynamic): Dynamic =>
                input2.cov < 0.85 ? callback39(input2) : Promise.resolve(null),
            ),
          ),
          value71: Dynamic = value66.map(
            (input2?: Dynamic, options3?: Dynamic): Dynamic => ({
              board: input2.board,
              cov: input2.cov,
              part: (0, runtime.describeCommentAreaLocation)(
                input2.b,
                input2.cov,
              ),
              ...callback40(input2, value70[options3] ?? null),
            }),
          ),
          value72: Dynamic = (0, runtime.unionCommentRects)(
            value66.map((input2?: Dynamic): Dynamic => input2.frame),
          );
        return {
          anchor: {
            kind: "boards",
            page: pageKey,
            boards: value66.map(
              (input2?: Dynamic): Dynamic => ({
                file: input2.board.file,
                cov: input2.cov,
              }),
            ),
            box: {
              ...(0, runtime.normalizeCommentArea)(input, value72),
              ...(options2 != null
                ? {
                    corner: options2,
                  }
                : {}),
            },
          },
          label: (0, runtime.commentArtboardAreaShortLabel)(value71),
          detail: (0, runtime.commentArtboardAreaDetail)(value71),
        };
      },
      value36: Dynamic = (0, runtime.react_mi.useRef)(callback25);
    value36.current = callback25;
    let value37: Dynamic = (0, runtime.react_mi.useRef)(callback20);
    value37.current = callback20;
    let callback27: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
      ): Promise<Dynamic> => {
        if (!value2.current || !value6) return null;
        let value64: Dynamic = value12.find(
            (input2?: Dynamic): Dynamic => input2.id === input,
          ),
          value65: Dynamic = value64
            ? (0, runtime.parseDesignCommentAnchor)(value64.anchor)
            : null;
        if (!value65) return null;
        let state: Dynamic = {
          x: options2.x - (window as Dynamic).scrollX,
          y: options2.y - (window as Dynamic).scrollY,
        };
        if (!callback14(state.x, state.y)) return null;
        let value66: Dynamic;
        if (
          value65.kind === "area" ||
          value65.kind === "boards" ||
          value65.kind === "notearea"
        ) {
          let value73: Dynamic = callback11(value65),
            value74: Dynamic =
              value65.kind === "notearea"
                ? callback12(value65)
                : value73
                  ? (0, runtime.commentAreaHandlePoint)(
                      value73,
                      value65.box.corner,
                    )
                  : null,
            value75: Dynamic = callback22(state.x, state.y);
          if (
            !value73 ||
            !value74 ||
            !value75 ||
            (value65.kind === "notearea" &&
              Math.round(value75.x - value74.x) === 0 &&
              Math.round(value75.y - value74.y) === 0)
          )
            return null;
          let value76: Dynamic =
              value73.w / ((value65.box.x1 - value65.box.x0) * 100),
            value77: Dynamic =
              value73.h / ((value65.box.y1 - value65.box.y0) * 100),
            value78: Dynamic =
              value65.kind === "notearea"
                ? value75.x - value74.x
                : Math.round((value75.x - value74.x) / value76) * value76,
            value79: Dynamic =
              value65.kind === "notearea"
                ? value75.y - value74.y
                : Math.round((value75.y - value74.y) / value77) * value77;
          value66 = await callback26(
            {
              x: value73.x + value78,
              y: value73.y + value79,
              w: value73.w,
              h: value73.h,
            },
            value65.kind === "notearea"
              ? (0, runtime.nearestCommentAreaCorner)(value73, value74)
              : value65.box.corner,
            undefined,
            1500,
          );
          let value80: Dynamic =
            value65.kind === "notearea" ? callback7(value65.idHash) : null;
          if (
            value80 &&
            value66?.anchor.kind === "notearea" &&
            value66.anchor.id === value80.id
          ) {
            let value81: Dynamic = (0, runtime.moveObjectCommentArea)(
              value80,
              options.annBox(value80),
              value65.box,
              value74,
              value75,
            );
            if (value81.x0 === value65.box.x0 && value81.y0 === value65.box.y0)
              return null;
            let value82: Dynamic = (0, runtime.normalizeCommentArea)(
              (0, runtime.rotatedAnnotationBounds)(
                value80,
                (0, runtime.objectCommentAreaRect)(
                  value80,
                  options.annBox(value80),
                  value81,
                ),
              ),
              (0, runtime.rotatedAnnotationBounds)(
                value80,
                options.annBox(value80),
              ),
            );
            value66 = {
              anchor: {
                kind: "notearea",
                id: value80.id,
                box: value81,
              },
              label: (0, runtime.commentObjectAreaShortLabel)(value80, value82),
              detail: (0, runtime.commentObjectAreaDetail)(value80, value81),
            };
          }
          value66 &&
            value66.anchor.kind !== "area" &&
            value66.anchor.kind !== "boards" &&
            value66.anchor.kind !== "notearea" &&
            (value66 = null);
        } else value66 = await callback19(state.x, state.y, 1500);
        let value67: Dynamic = value66
          ? (0, runtime.serializeDesignCommentAnchor)(value66.anchor)
          : null;
        if (!value66 || !value67 || value2.current == null || !value9.current)
          return null;
        let value68: Dynamic =
            value66.anchor.kind === "area" ||
            value66.anchor.kind === "boards" ||
            value66.anchor.kind === "notearea",
          value69: Dynamic = (0, runtime.parseDesignCommentAnchor)(value67),
          flag: Dynamic = false;
        if (
          value69 &&
          (value69.kind === "el" || value69.kind === "area") &&
          value69.path != null
        ) {
          let value73: Dynamic = callback6(value69.fileHash);
          flag =
            value73 == null ||
            value17
              .get(value73)
              ?.get(commentScopeKey(value69.path, value69.tid, value69.fp)) ===
              undefined;
        }
        let value70: Dynamic = value69 && !flag ? callback12(value69) : null,
          value71: Dynamic = value70 ? callback23(value70) : null,
          value72: Dynamic = value71
            ? {
                x: Math.round(value71.x + (window as Dynamic).scrollX),
                y: Math.round(value71.y + (window as Dynamic).scrollY),
              }
            : options2;
        return {
          anchor: value67,
          at: value72,
          label: value66.label,
          ...(value66.detail
            ? {
                detail: value66.detail,
              }
            : {}),
          ...(value68
            ? {
                area: true,
              }
            : {}),
        };
      },
      value38: Dynamic = (0, runtime.react_mi.useRef)(callback27);
    value38.current = callback27;
    let value39: Dynamic =
        value6 && value3
          ? manifest.artboards.filter(
              (input?: Dynamic): Dynamic => callback9(input.file),
            )
          : [],
      value40: Dynamic =
        value6 && value3 && value39.length === 0 && fullscreenFile == null,
      value41: Dynamic = value40
        ? [canvasCommentScopeKey]
        : value39.map((input?: Dynamic): Dynamic => input.file),
      value42: Dynamic = (0, runtime.react_mi.useRef)(value41);
    value42.current = value41;
    let value43: Dynamic = (0, runtime.react_mi.useRef)(new Map()),
      value44: Dynamic = (0, runtime.react_mi.useRef)(new Map()),
      callback28: Dynamic = (input?: Dynamic): Dynamic => {
        let entry: Dynamic = value44.current.get(input);
        entry ||
          ((entry = (input2?: Dynamic): Dynamic => {
            input2
              ? value43.current.set(input, input2)
              : (value43.current.delete(input), value44.current.delete(input));
          }),
          value44.current.set(input, entry));
        return entry;
      },
      callback29: Dynamic = (): Dynamic => {
        let current: Dynamic = surfaceRef.current,
          entry: Dynamic = camera.get(),
          value64: Dynamic = current
            ? (0, runtime.toolbarOverlayHeight)(current)
            : 0,
          value65: Dynamic = (current?.clientWidth || 0) / entry.scale,
          value66: Dynamic = (current?.clientHeight || 0) / entry.scale,
          callback38: Dynamic = (input?: Dynamic): Dynamic => {
            let value68: Dynamic =
              input === canvasCommentScopeKey ? null : callback5(input);
            if (!value68 || !current) return true;
            let value69: Dynamic = callback10(value68);
            return (
              value69.x < entry.x + value65 &&
              value69.x + value69.w > entry.x &&
              value69.y < entry.y + value66 &&
              value69.y + value69.h > entry.y + value64 / entry.scale
            );
          },
          value67: Dynamic = null;
        for (let value68 of value42.current as Dynamic) {
          let entry2: Dynamic = value43.current.get(value68);
          if (entry2 && ((value67 ??= entry2), callback38(value68)))
            return entry2;
        }
        return value67;
      },
      [value45, value46]: Dynamic = (0, runtime.react_mi.useState)(null),
      value47: Dynamic = (0, runtime.react_mi.useRef)(null),
      callback30: Dynamic = (): Dynamic => {
        setTimeout((): Dynamic => {
          let current: Dynamic = value47.current,
            activeElement: Dynamic = (document as Dynamic).activeElement;
          current == null ||
            !value9.current ||
            !(document as Dynamic).hasFocus() ||
            ((activeElement === null ||
              activeElement === (document as Dynamic).body ||
              activeElement === (document as Dynamic).documentElement) &&
              value43.current.get(current)?.focus({
                preventScroll: true,
              }));
        }, 0);
      };
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      value10 || callback30();
    }, [value10]);
    let [value48, value49]: Dynamic = (0, runtime.react_mi.useState)(false),
      [value50, value51]: Dynamic = (0, runtime.react_mi.useState)(false),
      value52: Dynamic = (0, runtime.react_mi.useRef)({
        ring: false,
        marker: false,
      }),
      value53: Dynamic = (0, runtime.react_mi.useRef)(false),
      value54: Dynamic = (0, runtime.react_mi.useRef)(null),
      callback31: Dynamic = (
        input?: Dynamic,
        options2: Dynamic = input,
      ): Dynamic => {
        let current: Dynamic = value52.current;
        options2 && !current.marker && (value54.current = null);
        value53.current = options2;
        current.ring !== input && value49((current.ring = input));
        current.marker !== options2 && value51((current.marker = options2));
      },
      value55: Dynamic = (0, runtime.react_mi.useRef)(false);
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      if (!value6) {
        value47.current = null;
        callback31(false);
        return;
      }
      let callback38: Dynamic = (input?: Dynamic): Dynamic => {
          if (!value52.current.marker) return;
          let current: Dynamic = value54.current;
          current
            ? Math.abs(input.clientX - current.x) +
                Math.abs(input.clientY - current.y) >
                commentClickMovementThresholdPixels &&
              callback31(value52.current.ring, false)
            : (value54.current = {
                x: input.clientX,
                y: input.clientY,
              });
        },
        callback39: Dynamic = (input?: Dynamic): Dynamic => {
          (0, runtime.isCommentTargetEvent)(input) ||
            (callback31(false), (value47.current = null));
        },
        callback40: Dynamic = (input?: Dynamic): Dynamic => {
          input.key === "Tab" &&
            ((value55.current = true),
            setTimeout((): Dynamic => (value55.current = false), 0));
        };
      (document as Dynamic).addEventListener("pointermove", callback38, {
        capture: true,
        passive: true,
      });
      (document as Dynamic).addEventListener("pointerdown", callback39, {
        capture: true,
        passive: true,
      });
      (document as Dynamic).addEventListener("keydown", callback40, true);
      (window as Dynamic).addEventListener("focus", callback30);
      return (): Dynamic => {
        (document as Dynamic).removeEventListener("pointermove", callback38, {
          capture: true,
        });
        (document as Dynamic).removeEventListener("pointerdown", callback39, {
          capture: true,
        });
        (document as Dynamic).removeEventListener("keydown", callback40, true);
        (window as Dynamic).removeEventListener("focus", callback30);
      };
    }, [value6]);
    let value56: Dynamic = (0, runtime.react_mi.useId)(),
      value57: Dynamic = (0, runtime.react_mi.useRef)(false);
    (0, runtime.react_mi.useEffect)((): Dynamic => {
      let value64: Dynamic = value6 && value3 && !value57.current;
      value57.current = value6 && value3;
      if (!value64) return;
      let value65: Dynamic =
        performance.now() - value5.current < commentRevealTimeoutMs;
      value5.current = Number.NEGATIVE_INFINITY;
      if (value65 || !(document as Dynamic).hasFocus()) return;
      let activeElement: Dynamic = (document as Dynamic).activeElement,
        value66: Dynamic =
          activeElement === null ||
          activeElement === (document as Dynamic).body ||
          activeElement === (document as Dynamic).documentElement,
        value67: Dynamic =
          activeElement?.tagName === "IFRAME" &&
          !!activeElement.closest("[data-mega-artboard]") &&
          !!surfaceRef.current?.contains(activeElement);
      value67 && activeElement.blur();
      (value66 || value67) &&
        (callback29()?.focus({
          preventScroll: true,
        }),
        typeof matchMedia == "function" &&
          matchMedia("(hover: none)").matches &&
          (callback31(false), (value53.current = true)));
    }, [value6, value3]);
    (0, runtime.react_mi.useLayoutEffect)((): Dynamic => {
      if (value45 == null || value43.current.has(value45)) return;
      value46(null);
      let activeElement: Dynamic = (document as Dynamic).activeElement;
      !(document as Dynamic).hasFocus() ||
        !(
          activeElement === null ||
          activeElement === (document as Dynamic).body ||
          activeElement === (document as Dynamic).documentElement
        ) ||
        (value6
          ? callback29()?.focus({
              preventScroll: true,
            })
          : surfaceRef.current
              ?.querySelector(
                '[data-mega-artboard="' +
                  CSS.escape(value45) +
                  '"] [data-mega-title-text]',
              )
              ?.focus({
                preventScroll: true,
              }));
    });
    let callback32: Dynamic = (
        input?: Dynamic,
        options2: Dynamic = false,
      ): Dynamic => {
        let current: Dynamic = surfaceRef.current;
        if (!current || value.current.fullscreenFile != null) return;
        let callback38: Dynamic = (input2?: Dynamic): Dynamic => {
          let state: Dynamic = {
              w: current.clientWidth || 1,
              h: current.clientHeight || 1,
              top: (0, runtime.toolbarOverlayHeight)(current),
            },
            value64: Dynamic =
              input.w <= state.w / input2.scale &&
              input.h <= (state.h - state.top) / input2.scale;
          return (0, runtime.isArtboardInViewport)(
            input2,
            value64
              ? input
              : {
                  x: input.x + input.w / 2,
                  y: input.y,
                  w: input.w / 2,
                  h: input.h / 2,
                },
            state,
          );
        };
        options2 ? camera.set(callback38, true) : camera.glide(callback38);
      },
      callback33: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = surfaceRef.current;
        if (!current) return null;
        let entry: Dynamic = camera.get();
        if (input === canvasCommentScopeKey) {
          let value68: Dynamic = (0, runtime.toolbarOverlayHeight)(current),
            value69: Dynamic =
              entry.x + (current.clientWidth || 1) / 2 / entry.scale,
            value70: Dynamic =
              entry.y +
              (value68 + ((current.clientHeight || 1) - value68) / 2) /
                entry.scale;
          return {
            anchor: {
              kind: "canvas",
              page: pageKey,
              x: value69,
              y: value70,
            },
            label: (0, runtime.commentAnchorShortLabel)({
              kind: "canvas",
              pages: manifest.pages,
              pageKey: pageKey,
            }),
            detail: (0, runtime.commentCanvasPointDetail)(value69, value70),
            p: {
              x: value69,
              y: value70,
            },
          };
        }
        let value64: Dynamic = callback5(input);
        if (!value64) return null;
        let value65: Dynamic = callback10(value64),
          { fx: value66, fy: value67 }: Dynamic = (0,
          runtime.defaultArtboardCommentPoint)(value65, entry.scale);
        return {
          anchor: {
            kind: "artboard",
            file: value64.file,
            fx: value66,
            fy: value67,
          },
          label: (0, runtime.commentAnchorShortLabel)({
            kind: "artboard",
            board: value64,
          }),
          detail: (0, runtime.commentArtboardElementDetail)(value64),
          p: {
            x: value65.x + value66 * value65.w,
            y: value65.y + value67 * value65.h,
          },
        };
      },
      callback34: Dynamic = (input?: Dynamic): Dynamic => {
        value29.current.cancel();
        let current: Dynamic = value2.current,
          current2: Dynamic = surfaceRef.current;
        if (!current || !value6 || !current2) return;
        let value64: Dynamic = callback33(input),
          value65: Dynamic = value64
            ? (0, runtime.serializeDesignCommentAnchor)(value64.anchor)
            : null;
        if (!value64 || !value65) return;
        let bounds: Dynamic = current2.getBoundingClientRect(),
          entry: Dynamic = camera.get(),
          value66: Dynamic = (0, runtime.toolbarOverlayHeight)(current2),
          callback38: Dynamic = (
            input2?: Dynamic,
            options2?: Dynamic,
            context?: Dynamic,
          ): Dynamic =>
            Math.max(options2, Math.min(Math.max(options2, context), input2)),
          state: Dynamic = {
            x: Math.round(
              callback38(
                bounds.left + (value64.p.x - entry.x) * entry.scale,
                bounds.left + commentPointerMovementThreshold,
                bounds.right - commentPointerMovementThreshold,
              ) + (window as Dynamic).scrollX,
            ),
            y: Math.round(
              callback38(
                bounds.top + (value64.p.y - entry.y) * entry.scale,
                bounds.top + value66 + commentPointerMovementThreshold,
                bounds.bottom - commentPointerMovementThreshold,
              ) + (window as Dynamic).scrollY,
            ),
          };
        value47.current = input;
        current
          .compose(value65, state, {
            label: value64.label,
            detail: value64.detail,
          })
          .then(
            (input2?: Dynamic): Dynamic => {
              input2.opened && value30.clear();
            },
            (): Dynamic => {},
          );
      },
      callback35: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let current: Dynamic = value53.current;
        callback31(true);
        if (options2 && !current) return;
        let value64: Dynamic =
          input === canvasCommentScopeKey ? null : callback5(input);
        value64 &&
          callback32(
            {
              x: value64.x,
              y: value64.y,
              w: value64.w,
              h: value64.h,
            },
            true,
          );
        callback34(input);
      },
      callback36: Dynamic = (input?: Dynamic): Dynamic => {
        let value64: Dynamic = (0, runtime.buttonKeyboardActivation)(
          (): Dynamic => callback35(input, true),
        );
        return {
          onKeyDown(input2: Dynamic): Dynamic {
            input2.key !== "Enter" && input2.key !== " " && callback31(true);
            value64.onKeyDown(input2);
          },
          onKeyUp: value64.onKeyUp,
          onClick(event: Dynamic): Dynamic {
            event.target === event.currentTarget &&
              (event.currentTarget.focus({
                preventScroll: true,
              }),
              callback35(input, false));
          },
          onFocus(input2: Dynamic): Dynamic {
            value47.current = null;
            value46(input);
            value54.current = null;
            callback31(true);
            let value65: Dynamic =
              input === canvasCommentScopeKey ? null : callback5(input);
            value65 &&
              input2.relatedTarget != null &&
              callback32({
                x: value65.x,
                y: value65.y,
                w: value65.w,
                h: value65.h,
              });
          },
          onBlur(input2: Dynamic): Dynamic {
            value64.onBlur(input2);
            value46(
              (input3?: Dynamic): Dynamic => (input3 === input ? null : input3),
            );
            let relatedTarget: Dynamic = input2.relatedTarget;
            value55.current &&
              relatedTarget &&
              !value33.current?.contains(relatedTarget) &&
              (0, runtime.announce)(
                (): Dynamic =>
                  value9.current
                    ? runtime.AccessibilityAnnouncementsLabel_24
                    : null,
              );
          },
        };
      },
      value58: Dynamic = (0, runtime.react_mi.useRef)({
        dx: 0,
        dy: 0,
        raf: null,
      }),
      callback37: Dynamic = (input?: Dynamic): Dynamic => {
        if (fullscreenFile == null) return;
        let value64: Dynamic =
            input.deltaMode === 1
              ? 16
              : input.deltaMode === 2
                ? (window as Dynamic).innerHeight
                : 1,
          current: Dynamic = value58.current;
        current.dx += input.deltaX * value64;
        current.dy += input.deltaY * value64;
        current.raf == null &&
          (current.raf = requestAnimationFrame((): Dynamic => {
            let { dx: value65, dy: value66 }: Dynamic = current;
            value58.current = {
              dx: 0,
              dy: 0,
              raf: null,
            };
            let fullscreenFile2: Dynamic = value.current.fullscreenFile,
              value67: Dynamic =
                fullscreenFile2 == null
                  ? undefined
                  : handlesRef.current.get(fullscreenFile2);
            (0, runtime.createPreviewHandle)(
              value67?.webviewRef.current ?? null,
            )?.executeJavaScriptUnchecked(
              "scrollBy(" +
                JSON.stringify(value65) +
                "," +
                JSON.stringify(value66) +
                ")",
            );
            let current2: Dynamic = value22.current;
            current2 && value28.current(current2.x, current2.y);
          }));
      },
      value59: Dynamic = ((): Dynamic => {
        let value64: Dynamic = value12.find(
            (input?: Dynamic): Dynamic => input.active,
          ),
          value65: Dynamic = value64
            ? (0, runtime.parseDesignCommentAnchor)(value64.anchor)
            : null,
          value66: Dynamic =
            value65?.kind === "notearea" && fullscreenFile == null
              ? callback7(value65.idHash)
              : null;
        return value65?.kind === "notearea"
          ? value66
            ? (0, runtime.objectCommentAreaRect)(
                value66,
                options.annBox(value66),
                value65.box,
              )
            : null
          : value65 && (value65.kind === "area" || value65.kind === "boards")
            ? (callback11(value65) ?? null)
            : null;
      })();
    if (!value6) return null;
    let value60: Dynamic =
        surfaceRef.current?.clientWidth || (window as Dynamic).innerWidth,
      value61: Dynamic =
        surfaceRef.current?.clientHeight || (window as Dynamic).innerHeight,
      value62: Dynamic = ((): Dynamic => {
        if (value45 == null || !value48) return null;
        if (value45 === canvasCommentScopeKey) {
          if (!value40) return null;
          let value68: Dynamic = callback33(canvasCommentScopeKey);
          return value68
            ? {
                inset: commentPointerStrokeInset,
                px: (value68.p.x - value8.x) * value8.scale,
                py: (value68.p.y - value8.y) * value8.scale,
              }
            : null;
        }
        let value64: Dynamic = callback5(value45);
        if (!value64 || !callback9(value64.file)) return null;
        let value65: Dynamic = callback10(value64),
          { fx: value66, fy: value67 }: Dynamic = (0,
          runtime.defaultArtboardCommentPoint)(value65, value8.scale);
        return {
          x: (value65.x - value8.x) * value8.scale,
          y: (value65.y - value8.y) * value8.scale,
          w: value65.w * value8.scale,
          h: value65.h * value8.scale,
          px: (value65.x + value66 * value65.w - value8.x) * value8.scale,
          py: (value65.y + value67 * value65.h - value8.y) * value8.scale,
        };
      })(),
      value63: Dynamic = ((): Dynamic => {
        if (value35) {
          let value64: Dynamic = (value35.pin.x - value8.x) * value8.scale,
            value65: Dynamic = (value35.pin.y - value8.y) * value8.scale,
            { x1: value66, y1: value67 }: Dynamic = value35;
          return {
            x: Math.min(value64, value66),
            y: Math.min(value65, value67),
            w: Math.abs(value66 - value64),
            h: Math.abs(value67 - value65),
            ox: value35.resizing ? value66 : value64,
            oy: value35.resizing ? value67 : value65,
          };
        }
        return value59
          ? {
              x: (value59.x - value8.x) * value8.scale,
              y: (value59.y - value8.y) * value8.scale,
              w: value59.w * value8.scale,
              h: value59.h * value8.scale,
              deg: value59.deg,
            }
          : value32
            ? {
                x: (value32.x - value8.x) * value8.scale,
                y: (value32.y - value8.y) * value8.scale,
                w: value32.w * value8.scale,
                h: value32.h * value8.scale,
                ox: (value32.ox - value8.x) * value8.scale,
                oy: (value32.oy - value8.y) * value8.scale,
              }
            : null;
      })();
    return (
      <div
        ref={value33}
        data-mega-chrome={"comments"}
        data-testid={"mega-comment-layer"}
        className={"absolute inset-0 z-[48]"}
        style={{
          cursor: runtime.commentPointerCursor,
        }}
        onPointerDown={(event?: Dynamic): Dynamic => {
          event.button !== 0 ||
            (0, runtime.isCommentTargetEvent)(event.nativeEvent) ||
            callback24(event) ||
            (0, runtime.watchPointerRelease)(
              event.nativeEvent,
              (input?: Dynamic): Dynamic => value37.current(input),
            );
        }}
        onPointerMove={callback18}
        onPointerLeave={(): Dynamic => {
          value21.current += 1;
          value27.current.next = null;
          value22.current = null;
          callback3(null);
        }}
        onWheel={callback37}
      >
        {value63?.deg ? (
          <div
            className={"pointer-events-none absolute h-0 w-0"}
            style={{
              left: value63.x + value63.w / 2,
              top: value63.y + value63.h / 2,
              transform: "rotate(" + String(value63.deg) + "deg)",
            }}
          >
            <runtime.CommentAreaOutline
              rect={{
                left: -value63.w / 2,
                top: -value63.h / 2,
                width: value63.w,
                height: value63.h,
              }}
              kind={"thread"}
            />
          </div>
        ) : (
          value63 && (
            <runtime.CommentAreaOutline
              rect={{
                left: value63.x,
                top: value63.y,
                width: value63.w,
                height: value63.h,
              }}
              origin={
                value63.ox != null && value63.oy != null
                  ? {
                      x: value63.ox,
                      y: value63.oy,
                    }
                  : null
              }
              handle={!!value32 && !value35 && !value59}
              onHandlePointerDown={(input?: Dynamic): Dynamic => {
                !value32 ||
                  input.button !== 0 ||
                  input.pointerType !== "mouse" ||
                  (input.stopPropagation(),
                  callback24(input, {
                    x:
                      value32.ox <= value32.x + value32.w / 2
                        ? value32.x + value32.w
                        : value32.x,
                    y:
                      value32.oy <= value32.y + value32.h / 2
                        ? value32.y + value32.h
                        : value32.y,
                  }));
              }}
              kind={value35 ? "marquee" : value59 ? "thread" : "drawn"}
            />
          )
        )}
        {value19 && !value35 && (
          <div
            aria-hidden={true}
            className={
              "pointer-events-none absolute rounded border-[1.5px] border-editor-comment-target"
            }
            style={{
              left: (value19.x - value8.x) * value8.scale,
              top: (value19.y - value8.y) * value8.scale,
              width: value19.w * value8.scale,
              height: value19.h * value8.scale,
            }}
          />
        )}
        {value39.map((input?: Dynamic): Dynamic => {
          let value64: Dynamic = callback10(input),
            value65: Dynamic = (0, runtime.clampCommentAreaToViewport)(
              {
                x: (value64.x - value8.x) * value8.scale,
                y: (value64.y - value8.y) * value8.scale,
                w: value64.w * value8.scale,
                h: value64.h * value8.scale,
              },
              value60,
              value61,
            );
          return (() => {
            const _Component = "div";
            const _props = {
              ref: callback28(input.file),
              role: "button",
              tabIndex: 0,
              "data-mega-comment-target": input.file,
              "data-testid": "mega-comment-target-" + input.file,
              "aria-label": (0, runtime.commentSurfaceAriaLabel)({
                kind: "artboard",
                board: input,
              }),
              "aria-describedby": value56,
              className: "pointer-events-none absolute outline-none",
              style: {
                left: value65.x,
                top: value65.y,
                width: value65.w,
                height: value65.h,
              },
              ...callback36(input.file),
            } as const;
            const _key = input.file;
            return <_Component key={_key} {..._props} />;
          })();
        })}
        {value40 && (
          <div
            ref={callback28(canvasCommentScopeKey)}
            role={"button"}
            tabIndex={0}
            data-mega-comment-target={""}
            data-testid={"mega-comment-target-canvas"}
            aria-label={(0, runtime.commentSurfaceAriaLabel)({
              kind: "canvas",
              pages: manifest.pages,
              pageKey: pageKey,
            })}
            aria-describedby={value56}
            className={"pointer-events-none absolute inset-0 outline-none"}
            {...callback36(canvasCommentScopeKey)}
          />
        )}
        {value41.length > 0 && (
          <span id={value56} hidden={true}>
            {(0, runtime.commentTargetKeyboardHint)({
              several: value41.length > 1,
              canvas: value40,
            })}
          </span>
        )}
        {value62 && (
          <jsx_mg.Fragment>
            <div
              aria-hidden={true}
              data-testid={"mega-comment-focus-ring"}
              className={
                "pointer-events-none absolute rounded border-2 border-editor-comment-target"
              }
              style={{
                ...("inset" in value62
                  ? {
                      top: value62.inset,
                      right: value62.inset,
                      bottom: value62.inset,
                      left: value62.inset,
                    }
                  : {
                      left: value62.x,
                      top: value62.y,
                      width: value62.w,
                      height: value62.h,
                    }),
                boxShadow: `0 0 0 ${commentPointerStrokeInset}px #fff`,
              }}
            />
            {value50 && (
              <runtime.CommentPointer
                data-testid={"mega-comment-focus-pin"}
                at={{
                  x: value62.px,
                  y: value62.py,
                }}
              />
            )}
          </jsx_mg.Fragment>
        )}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsx_mg",
    () => jsx_mg,
    (value) => {
      jsx_mg = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentAnchorRefreshIntervalMs",
    () => commentAnchorRefreshIntervalMs,
    (value) => {
      commentAnchorRefreshIntervalMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPlacementInsetPixels",
    () => commentPlacementInsetPixels,
    (value) => {
      commentPlacementInsetPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentRevealTimeoutMs",
    () => commentRevealTimeoutMs,
    (value) => {
      commentRevealTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasCommentScopeKey",
    () => canvasCommentScopeKey,
    (value) => {
      canvasCommentScopeKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerStrokeInset",
    () => commentPointerStrokeInset,
    (value) => {
      commentPointerStrokeInset = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerMovementThreshold",
    () => commentPointerMovementThreshold,
    (value) => {
      commentPointerMovementThreshold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentClickMovementThresholdPixels",
    () => commentClickMovementThresholdPixels,
    (value) => {
      commentClickMovementThresholdPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCommentAreaElementLabels",
    () => maxCommentAreaElementLabels,
    (value) => {
      maxCommentAreaElementLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentScopeKey",
    () => commentScopeKey,
    (value) => {
      commentScopeKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentRectsEqual",
    () => commentRectsEqual,
    (value) => {
      commentRectsEqual = value;
    },
  );
  bindRuntimeValue(runtime, "useCanvasComments", () => useCanvasComments);
  return () => {
    jsx_mg = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    commentAnchorRefreshIntervalMs = 1e3;
    commentPlacementInsetPixels = 12;
    commentRevealTimeoutMs = 1500;
    canvasCommentScopeKey = "\0canvas";
    commentPointerStrokeInset = 2;
    commentPointerMovementThreshold = 8;
    commentClickMovementThresholdPixels = 4;
    maxCommentAreaElementLabels = 8;
    commentScopeKey = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      String(options) +
      (context ?? "") +
      `
` +
      input;
    commentRectsEqual = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input === options ||
      (!!input &&
        !!options &&
        input.x === options.x &&
        input.y === options.y &&
        input.w === options.w &&
        input.h === options.h);
  };
}
