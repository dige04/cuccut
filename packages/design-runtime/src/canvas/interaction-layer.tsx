/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasInteractionLayer(
  runtime: RuntimeBindings,
): () => void {
  var canvasDragSequence: Dynamic;
  function toggleArtboardDragCurtain(
    artboard?: Dynamic,
    enabled?: Dynamic,
    templateIds: Dynamic = [],
    passthrough: Dynamic = false,
  ): Dynamic {
    let value: Dynamic = artboard
      ? (0, runtime.createPreviewHandle)(artboard.webviewRef.current)
      : null;
    value &&
      (0, runtime.pickerHoverAt)(
        value,
        enabled,
        templateIds,
        passthrough,
        (enabled && artboard?.textTids()) ?? [],
      );
  }
  function CanvasInteractionLayer(options?: Dynamic): Dynamic {
    let {
        manifest: manifest,
        onManifestChange: onManifestChange,
        camera: camera,
        canvasScaleRef: canvasScaleRef,
        assets: assets,
        doc: doc,
        editing: editing,
        editable: editable,
        inspect = false,
        frameArmed: frameArmed,
        focusedFile: focusedFile,
        onFocus: onFocus,
        enteredFile = null,
        onEnterPiece: onEnterPiece,
        onFaceDoubleClick: onFaceDoubleClick,
        emptyPieces: emptyPieces,
        onContentHull: onContentHull,
        selectedArtboards: selectedArtboards,
        selectedNotes: selectedNotes,
        onSelectObjects: onSelectObjects,
        onClearSelection: onClearSelection,
        onAddAnnotation: onAddAnnotation,
        onDeleteAnnotation: onDeleteAnnotation,
        onAnnotationCss: onAnnotationCss,
        onReplaceAnnotationMedia: onReplaceAnnotationMedia,
        onOpenPropsPanel: onOpenPropsPanel,
        onMarqueeBegin: onMarqueeBegin,
        onElementPress: onElementPress,
        onCoverPress: onCoverPress,
        onCoverPick: onCoverPick,
        onArmArtboard: onArmArtboard,
        onSetMoveCommit: onSetMoveCommit,
        armedEmpty: armedEmpty,
        onSetMoveSay: onSetMoveSay,
        onPressIntent: onPressIntent,
        pressIntentIs: pressIntentIs,
        routeForwardedKey: routeForwardedKey,
        onDragEvent: onDragEvent,
        onBoxEvent: onBoxEvent,
        dragGhost: dragGhost,
        onHostDrag: onHostDrag,
        onHostGesturing: onHostGesturing,
        dragToast: dragToast,
        quickProps: quickProps,
        onTextFormat: onTextFormat,
        crossFile: crossFile,
        onArtboardReady: onArtboardReady,
        dsVarNames: dsVarNames,
        onDefinedVars: onDefinedVars,
        onArtboardProblems: onArtboardProblems,
        artboardProblems: artboardProblems,
        onShowProblems: onShowProblems,
        artboardNotice: artboardNotice,
        onHandle: onHandle,
        onPreviewDropNotice: onPreviewDropNotice,
        onDuplicateObjects: onDuplicateObjects,
        onDropObjectInto: onDropObjectInto,
        onObjectHover: onObjectHover,
        setMovePieces: setMovePieces,
        onPlayArtboard: onPlayArtboard,
        playingFile = null,
        onExpandArtboard: onExpandArtboard,
        onExportArtboard: onExportArtboard,
        onExportArtboardPdf: onExportArtboardPdf,
        onExportAllArtboardsPdf: onExportAllArtboardsPdf,
        onExportSelectedArtboardsPdf: onExportSelectedArtboardsPdf,
        onExportArtboardHtmlZip: onExportArtboardHtmlZip,
        exportDisabledReason: exportDisabledReason,
        exportRules: exportRules,
        onArtboardSettings: onArtboardSettings,
        onOpenTweaks: onOpenTweaks,
        onToggleTweaks: onToggleTweaks,
        tweaksOpenFile: tweaksOpenFile,
        tweakRows: tweakRows,
        onTweaksRow: onTweaksRow,
        onTweaksDirty: onTweaksDirty,
        artboardSettings: artboardSettings,
        canvasObject: canvasObject,
        outlineArtboards: outlineArtboards,
        presentPropsTick: presentPropsTick,
        onPresentPropsHandled: onPresentPropsHandled,
        fullscreenFile: fullscreenFile,
        phone = false,
        fullscreenBox: fullscreenBox,
        livePins: livePins,
        inUseFiles: inUseFiles,
        onRenameArtboard: onRenameArtboard,
        onCanvasMenu: onCanvasMenu,
        renameRef: renameRef,
        onPanZoom: onPanZoom,
        streamDragFile: streamDragFile,
        onRepeatRefused: onRepeatRefused,
        onHistoryPush: onHistoryPush,
        onModelReparsed: onModelReparsed,
        onHistoryApply: onHistoryApply,
        onHistoryRevoke: onHistoryRevoke,
        onHistoryDrop: onHistoryDrop,
        onTweakEdit: onTweakEdit,
        sessionEpoch: sessionEpoch,
        actionsRef: actionsRef,
        elementMenuHidden = false,
        elementSelection: elementSelection,
        selectedTidsByFile: selectedTidsByFile,
        selectedRectsByFile: selectedRectsByFile,
        onSelectionEvent: onSelectionEvent,
        onSelectionSeq: onSelectionSeq,
        exitGuardRef: exitGuardRef,
        textEditOpenRef: textEditOpenRef,
        settleSessionRef: settleSessionRef,
        commitOpenTextEditRef: commitOpenTextEditRef,
        onSessionDirtyChange: onSessionDirtyChange,
        onEditInput: onEditInput,
        onLocalEdit: onLocalEdit,
        onUndoStack: onUndoStack,
        onToolChange: onToolChange,
        toolResetTick: toolResetTick,
        armedTool: armedTool,
        keyboard: keyboard2,
        onDrawArtboard: onDrawArtboard,
        onImageDrop: onImageDrop,
        onPlaceTool: onPlaceTool,
        onAddShape: onAddShape,
        onAddPen: onAddPen,
        onPlaceBlocked: onPlaceBlocked,
        placeRequest: placeRequest,
        onPlaceHandled: onPlaceHandled,
        onOpenFile: onOpenFile,
        onRevealComment: onRevealComment,
        onCommentsController: onCommentsController,
        onCommenting: onCommenting,
        pageKey = "",
        artboardPicking = false,
      }: Dynamic = options,
      value: Dynamic = !artboardPicking,
      entry: Dynamic = camera.get(),
      value2: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Map()),
      value3: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic, context?: Dynamic): Dynamic => {
          options2
            ? value2.current.set(input, options2)
            : value2.current.delete(input);
          onHandle(input, options2, context);
        },
      ),
      [value4, value5]: Dynamic = (0, runtime.reactVectorToolState_2.useState)(
        null,
      ),
      value6: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(value4);
    value6.current = value4;
    let value7: Dynamic =
        value4 && !crossFile && elementSelection?.tids?.length
          ? (input?: Dynamic): Dynamic => {
              let value250: Dynamic = elementSelection,
                file: Dynamic = value250.file,
                entry2: Dynamic = value2.current.get(file),
                value251: Dynamic = entry2
                  ? (0, runtime.createPreviewHandle)(entry2.webviewRef.current)
                  : null,
                current: Dynamic = value9.current;
              if (!value251 || !current) return;
              input.focus({
                preventScroll: true,
              });
              let bounds: Dynamic = input.getBoundingClientRect(),
                value252: Dynamic = callback16(
                  bounds.left + bounds.width / 2,
                  bounds.bottom,
                  current.getBoundingClientRect(),
                );
              (0, runtime.pickerCommentFor)(
                value251,
                value250.tids[0],
                value250.name ?? null,
              ).then((input2?: Dynamic): Dynamic => {
                let value253: Dynamic = manifest.artboards.find(
                  (input3?: Dynamic): Dynamic => input3.file === file,
                );
                if (!input2 || !value253) return;
                let value254: Dynamic =
                    value20?.file === file ? value20 : value253,
                  value255: Dynamic =
                    input2.path == null
                      ? {
                          x: 0,
                          y: 0,
                          w: value254.w,
                          h: value254.h,
                        }
                      : input2.rect,
                  { px: value256, py: value257 }: Dynamic = (0,
                  runtime.commentPointWithinVisibleContent)(
                    value252,
                    value254,
                    value255,
                  ),
                  value258: Dynamic =
                    (value256 - value255.x) / (value255.w || 1),
                  value259: Dynamic =
                    (value257 - value255.y) / (value255.h || 1),
                  value260: Dynamic = (0, runtime.serializeDesignCommentAnchor)(
                    input2.path != null
                      ? {
                          kind: "el",
                          file: file,
                          path: input2.path,
                          tid: input2.tid,
                          fp: input2.fp,
                          fx: value258,
                          fy: value259,
                        }
                      : input2.page
                        ? {
                            kind: "artboard",
                            file: file,
                            px: value256 - input2.page.x,
                            py: value257 - input2.page.y,
                          }
                        : {
                            kind: "artboard",
                            file: file,
                            fx: value258,
                            fy: value259,
                          },
                  );
                if (!value260) return;
                let value261: Dynamic =
                    input2.path == null
                      ? null
                      : (0, runtime.describeCommentElement)(entry2, input2),
                  value262: Dynamic = (0, runtime.commentAnchorShortLabel)(
                    value261 == null
                      ? {
                          kind: "artboard",
                          board: value253,
                        }
                      : {
                          kind: "el",
                          board: value253,
                          el: value261,
                        },
                  ),
                  value263: Dynamic =
                    input2.path != null && input2.tid != null
                      ? entry2?.viewEntries([input2.tid])[0]
                      : undefined,
                  value264: Dynamic = (0, runtime.commentArtboardElementDetail)(
                    value253,
                    value263 && value261
                      ? {
                          path: value263.path,
                          kind: value261.kind ?? value263.kind,
                          text: value261.text ?? value263.words(),
                        }
                      : null,
                  ),
                  bounds2: Dynamic = current.getBoundingClientRect(),
                  entry3: Dynamic = camera.get();
                value4
                  .compose(
                    value260,
                    {
                      x:
                        bounds2.left +
                        (value254.x + value256 - entry3.x) * entry3.scale +
                        (window as Dynamic).scrollX,
                      y:
                        bounds2.top +
                        (value254.y + value257 - entry3.y) * entry3.scale +
                        (window as Dynamic).scrollY,
                    },
                    {
                      label: value262,
                      detail: value264,
                    },
                  )
                  .catch((): Dynamic => {});
              });
            }
          : null,
      value8: Dynamic = value4
        ? (input?: Dynamic, options2?: Dynamic): Dynamic => {
            options2.focus({
              preventScroll: true,
            });
            let value250: Dynamic = (0, runtime.serializeDesignCommentAnchor)({
                kind: "note",
                id: input,
              }),
              value251: Dynamic = (manifest.annotations ?? []).find(
                (input2?: Dynamic): Dynamic => input2.id === input,
              ),
              bounds: Dynamic = options2.getBoundingClientRect();
            value250 &&
              value4
                .compose(
                  value250,
                  {
                    x: bounds.left + (window as Dynamic).scrollX,
                    y: bounds.bottom + 48 + (window as Dynamic).scrollY,
                  },
                  {
                    label: (0, runtime.commentAnchorShortLabel)({
                      kind: "note",
                      note: value251 ?? {
                        text: "",
                      },
                    }),
                  },
                )
                .catch((): Dynamic => {});
          }
        : null,
      value9: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      [value10, value11]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)({}),
      value12: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (source?: Dynamic): Dynamic =>
          (0, runtime.isShapeAnnotation)(source)
            ? (0, runtime.annotationBounds)(source).w
            : source.kind === "title1"
              ? (value10[source.id]?.w ??
                (0, runtime.NotesLinkEditingKind)(source))
              : source.w,
        [value10],
      ),
      value13: Dynamic = (0, runtime.reactVectorToolState_2.useRef)([]),
      value14: Dynamic = (0, runtime.artboardStackOrder)(
        value13.current,
        manifest.artboards,
      );
    (0, runtime.reactVectorToolState_2.useLayoutEffect)((): Dynamic => {
      value13.current = value14.map(
        (input?: Dynamic): Dynamic => input.spec.file,
      );
    });
    let entries: Dynamic = new Map(
        value14
          .filter((input?: Dynamic): Dynamic => input.spec.frameless !== true)
          .map(
            (input?: Dynamic, options2?: Dynamic): Dynamic => [
              input.spec.file,
              options2,
            ],
          ),
      ),
      value15: Dynamic = (0, runtime.useInspectorPosture)(),
      value16: Dynamic = (0, runtime.useTouchToolbar)(),
      value17: Dynamic = value15 === "sheet" && !value16,
      flag: Dynamic = false,
      value18: Dynamic = editing && (fullscreenFile == null || flag),
      value19: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(value18);
    value19.current = value18;
    let value20: Dynamic = (0, runtime.focusedArtboardContentRect)(
        manifest.artboards,
        fullscreenFile,
        fullscreenBox,
        flag,
        tweakRows,
      ),
      value21: Dynamic = phone && fullscreenFile == null,
      value22: Dynamic =
        value18 || (!value21 && inspect && (fullscreenFile == null || flag)),
      value23: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(value22);
    value23.current = value22;
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        value21 &&
        !flag &&
        (0, runtime.shouldDelayPreviewMount)(input, {
          editing: value18,
          runsNothing: options.phoneCanvasRunsNothing === true,
        }),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let value250: Dynamic =
          input == null
            ? undefined
            : manifest.artboards.find(
                (input2?: Dynamic): Dynamic => input2.file === input,
              );
        return value250 != null && callback(value250);
      },
      value24: Dynamic =
        value21 && !flag
          ? ((0, runtime.limitMountedPreviewPixels)(
              [...(livePins ?? [])],
              [value18 ? focusedFile : null, playingFile],
              manifest.artboards,
              options.phoneCanvasRunsNothing === true ? 0 : 15e5,
            ).find(
              (input?: Dynamic): Dynamic => livePins?.has(input) !== true,
            ) ?? null)
          : null,
      value25: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value26: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        selectedTidsByFile,
      );
    value26.current = selectedTidsByFile;
    let [value27, value28]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(false),
      value29: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      [value30, value31]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(false);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      value31(false);
    }, [selectedArtboards, selectedNotes, selectedTidsByFile]);
    let value32: Dynamic = (0,
      runtime.reactVectorToolState_2.useCallback)((): Dynamic => {
        let current: Dynamic = value25.current;
        current &&
          (current.raf && cancelAnimationFrame(current.raf),
          (value25.current = null),
          toggleArtboardDragCurtain(value2.current.get(current.file), null));
      }, []),
      callback3: Dynamic = (input?: Dynamic, event?: Dynamic): Dynamic => {
        if (
          !value18 ||
          event.pointerType === "touch" ||
          event.buttons !== 0 ||
          (armedTool != null &&
            armedTool !== "select" &&
            armedTool !== "vector")
        ) {
          value32();
          return;
        }
        value25.current && value25.current.file !== input && value32();
        let value250: Dynamic = (value25.current ??= {
          file: input,
          x: 0,
          y: 0,
          deep: false,
          raf: 0,
        });
        value250.x = event.nativeEvent.offsetX;
        value250.y = event.nativeEvent.offsetY;
        value250.deep = (0, runtime.isPrimaryModifierEvent)(event);
        (0, runtime.setPrimaryModifierHeld)(value250.deep);
        !value250.raf &&
          (value250.raf = requestAnimationFrame((): Dynamic => {
            value250.raf = 0;
            value25.current === value250 &&
              toggleArtboardDragCurtain(
                value2.current.get(input),
                {
                  x: value250.x,
                  y: value250.y,
                },
                value26.current?.[input],
                value250.deep,
              );
          }));
      };
    (0, runtime.reactVectorToolState_2.useEffect)(
      (): Dynamic => value32,
      [focusedFile, armedTool, value18, fullscreenFile, playingFile, value32],
    );
    let value33: Dynamic =
      value18 &&
      !value27 &&
      (armedTool == null || armedTool === "select") &&
      fullscreenFile == null &&
      focusedFile != null &&
      selectedArtboards.has(focusedFile)
        ? focusedFile
        : null;
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      let current: Dynamic = value25.current;
      value33 == null &&
        current?.file === focusedFile &&
        (current.raf && cancelAnimationFrame(current.raf),
        (value25.current = null));
    }, [value33, focusedFile]);
    (0, runtime.reactVectorToolState_2.useEffect)(
      (): Dynamic =>
        (0, runtime.subscribePrimaryModifierHeld)(
          (input?: Dynamic): Dynamic => {
            let current: Dynamic = value25.current;
            current &&
              ((current.deep = input),
              !current.raf &&
                toggleArtboardDragCurtain(
                  value2.current.get(current.file),
                  {
                    x: current.x,
                    y: current.y,
                  },
                  value26.current?.[current.file],
                  input,
                ));
          },
        ),
      [],
    );
    let value34: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(camera);
    value34.current = camera;
    (0, runtime.reactVectorToolState_2.useLayoutEffect)(
      (): Dynamic => camera.paint(),
    );
    let value35: Dynamic = phone && !flag,
      [value36, value37]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value38: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Map()),
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        let entry2: Dynamic = camera.get();
        input.el.style.transform =
          "translate(" +
          String((input.x - entry2.x) * entry2.scale) +
          "px, " +
          String((input.y - entry2.y) * entry2.scale) +
          "px) scale(" +
          String(entry2.scale) +
          ")";
      },
      [value39, value40]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)((): Dynamic => new Map()),
      value41: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Set()),
      value42: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => {
          let entry2: Dynamic = value2.current.get(input),
            value250: Dynamic = doc.content().files[input];
          !entry2 ||
            value41.current.has(input) ||
            (typeof value250 == "string" &&
              value250.length > runtime.quickActionImagePreviewMaxBytes) ||
            (value41.current.add(input),
            entry2.pageFill().then(
              (input2?: Dynamic): Dynamic => {
                let value251: Dynamic = (0, runtime.artboardHeaderTheme)(
                  input2,
                );
                value40(
                  (input3?: Dynamic): Dynamic =>
                    input3.has(input) && input3.get(input)?.bg === value251?.bg
                      ? input3
                      : new Map(input3).set(input, value251),
                );
              },
              (): Dynamic => {},
            ));
        },
      ),
      [value43, value44]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value45: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(false);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      if (value43 == null) return void (value45.current = false);
      let callback61: Dynamic = (): Dynamic =>
          value44(
            (input?: Dynamic): Dynamic => (input === value43 ? null : input),
          ),
        value250: Dynamic = fullscreenFile === value43;
      if (!value250 && value45.current) return callback61();
      value250 && (value45.current = true);
      let value251: Dynamic = (window as Dynamic).setTimeout(
          callback61,
          value250 ? 400 : 2e3,
        ),
        value252: Dynamic = value250
          ? requestAnimationFrame((): Dynamic => {
              (window as Dynamic).clearTimeout(value251);
              value251 = (window as Dynamic).setTimeout(callback61, 400);
            })
          : 0;
      return (): Dynamic => {
        (window as Dynamic).clearTimeout(value251);
        value252 && cancelAnimationFrame(value252);
      };
    }, [value43, fullscreenFile]);
    (0, runtime.reactVectorToolState_2.useEffect)(
      (): Dynamic =>
        value43 == null
          ? undefined
          : (0, runtime.preventTouchScroll)(value9.current),
      [value43],
    );
    let [value46, value47]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value48: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Set()),
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        if (input) {
          value48.current.add(input);
          input.style.transform = (0, runtime.viewportTransformCss)(
            camera.get(),
          );
          return (): Dynamic => {
            value48.current.delete(input);
          };
        }
      },
      value49: Dynamic = (0, runtime.useLatestCallback)((): Dynamic => {
        value38.current.forEach(callback4);
        let value250: Dynamic = (0, runtime.viewportTransformCss)(camera.get());
        value48.current.forEach((input?: Dynamic): Dynamic => {
          input.style.transform = value250;
        });
      }),
      [value50, value51]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value52: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Map()),
      callback6: Dynamic = (source?: Dynamic): Dynamic => {
        if (!value35 || !(0, runtime.isShapeAnnotation)(source)) return false;
        let value250: Dynamic =
            value130.current.size > 0
              ? value52.current.get(source.id)
              : undefined,
          value251: Dynamic =
            (source.kind === "image" && source.video !== undefined) ||
            ("css" in source &&
              (source.css?.filter !== undefined ||
                source.css?.["backdrop-filter"] !== undefined)),
          value252: Dynamic = (0, runtime.annotationBounds)(source),
          value253: Dynamic =
            value250 ??
            (!value251 &&
              !selectedNotes.has(source.id) &&
              value252.w * value252.h > 5e5);
        value52.current.set(source.id, value253);
        return value253;
      },
      [value53, value54]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      callback7: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        value35 ? (
          <runtime.ConditionalPortal key={input} on={true} to={value53}>
            <div
              ref={callback5}
              className={"absolute left-0 top-0 h-0 w-0"}
              style={{
                transformOrigin: "0 0",
              }}
            >
              {options2}
            </div>
          </runtime.ConditionalPortal>
        ) : (
          options2
        ),
      callback8: Dynamic =
        (input?: Dynamic, options2?: Dynamic, context?: Dynamic): Dynamic =>
        (input2?: Dynamic): Dynamic => {
          if (!input2) return;
          let state: Dynamic = {
            el: input2,
            x: options2,
            y: context,
          };
          value38.current.set(input, state);
          callback4(state);
          return (): Dynamic => {
            value38.current.delete(input);
          };
        };
    (0, runtime.reactVectorToolState_2.useLayoutEffect)((): Dynamic => {
      value35 && value49();
    });
    (0, runtime.reactVectorToolState_2.useEffect)(
      (): Dynamic => (value35 ? camera.subscribe(value49) : undefined),
      [camera, value35, value49],
    );
    let value55: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      fullscreenFile,
    );
    value55.current = fullscreenFile;
    let value56: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      playingFile,
    );
    value56.current = playingFile;
    let value57: Dynamic = (0, runtime.reactVectorToolState_2.useRef)({
      files: selectedArtboards,
      notes: selectedNotes,
    });
    value57.current = {
      files: selectedArtboards,
      notes: selectedNotes,
    };
    let value58: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        new Set(),
      ),
      value59: Dynamic =
        selectedNotes.size === 1 && selectedArtboards.size === 0
          ? [...selectedNotes][0]
          : null,
      value60: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          onSelectObjects(
            (0, runtime.boardSelectionItems)({
              file: input,
            }),
            options2 ? "toggle" : "replace",
          ),
      ),
      value61: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        onSelectObjects,
      );
    value61.current = onSelectObjects;
    let callback9: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.pointerType !== "touch" || !(event.target instanceof Element))
          return false;
        let ancestor: Dynamic = event.target.closest("[data-mega-chrome]");
        switch (ancestor?.getAttribute("data-mega-chrome")) {
          case "set-box-pad":
            return true;
          case "focus-overlay":
          case "face-overlay":
          case "set-overlay":
          case "title": {
            if (
              ancestor.getAttribute("data-mega-chrome") !== "title" &&
              !ancestor.hasAttribute("data-mega-piece")
            )
              return true;
            let value250: Dynamic = ancestor
              .closest("[data-mega-artboard]")
              ?.getAttribute("data-mega-artboard");
            return (0, runtime.isTouchSelectionStart)(
              event.pointerType,
              value250 != null && value57.current.files.has(value250),
            );
          }
          case "annotation":
            return (0, runtime.isTouchSelectionStart)(
              event.pointerType,
              value57.current.notes.has(
                ancestor.getAttribute("data-mega-annotation") ?? "",
              ),
            );
          default:
            return false;
        }
      },
      callback10: Dynamic = (event?: Dynamic): Dynamic => {
        if (!(event.target instanceof Element)) return true;
        let ancestor: Dynamic = event.target.closest("[data-mega-chrome]");
        return ancestor == null
          ? true
          : ancestor.getAttribute("data-mega-chrome") === "comments"
            ? (0, runtime.prefersDragGesture)(event, !!value6.current?.areas)
            : !value19.current &&
                ancestor.getAttribute("data-mega-chrome") === "annotation"
              ? true
              : callback9(event);
      },
      callback11: Dynamic = (): Dynamic =>
        value85.current === "hand" && !value128.current,
      callback12: Dynamic = (event?: Dynamic): Dynamic =>
        (0, runtime.isCanvasContextMenuPointer)({
          pointerType: event.pointerType,
          button: event.button,
          chrome:
            event.target instanceof Element
              ? event.target
                  .closest("[data-mega-chrome]")
                  ?.getAttribute("data-mega-chrome")
              : null,
        }),
      callback13: Dynamic = (event?: Dynamic): Dynamic =>
        event.button === 1 ||
        callback12(event) ||
        (event.button === 0 &&
          callback11() &&
          event.target instanceof Element &&
          event.target.hasAttribute("data-mega-pan-blanket")),
      callback14: Dynamic = (event?: Dynamic): Dynamic =>
        (0, runtime.shouldBeginCanvasMarquee)({
          pointerType: event.pointerType,
          button: event.button,
          tool: value85.current,
          bare:
            event.target === value9.current ||
            (event.target instanceof Element &&
              event.target.getAttribute("data-mega-chrome") === "set-box-pad"),
        }),
      callback15: Dynamic = (event?: Dynamic): Dynamic =>
        ((value85.current === "frame" ||
          value85.current === "note" ||
          (0, runtime.supportsClickPlacement)(value85.current)) &&
          (!(event.target instanceof Element) ||
            event.target.closest("[data-mega-chrome]") == null)) ||
        (value85.current === "draw" &&
          value84.current != null &&
          event.target instanceof Element &&
          event.target.closest("[data-mega-chrome], [data-mega-artboard]") ==
            null);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      let current: Dynamic = value9.current;
      if (!current) return;
      let value250: Dynamic = (0, runtime.installCanvasPanZoom)({
        element: current,
        getView: (): Dynamic => value34.current.get(),
        setView: (input?: Dynamic): Dynamic => {
          value55.current || value34.current.set(input);
        },
        limits: runtime.viewportScaleLimits,
        panSecondaryButton: true,
        shouldPan: (input?: Dynamic): Dynamic =>
          value55.current == null &&
          !value130.current.has("marquee") &&
          (input.button !== 2 || callback12(input)) &&
          (value97() ||
            callback13(input) ||
            (!callback15(input) && !callback14(input) && callback10(input))),
        allowNativeScroll: (event?: Dynamic): Dynamic => {
          let value251: Dynamic =
            event.target instanceof Element
              ? event.target.closest("[data-note-scroll]")
              : null;
          return !value251 ||
            Math.abs(event.deltaY) < Math.abs(event.deltaX) ||
            getComputedStyle(value251).overflowY !== "auto"
            ? false
            : event.deltaY < 0
              ? value251.scrollTop > 0
              : value251.scrollTop + value251.clientHeight <
                value251.scrollHeight - 1;
        },
      });
      return (): Dynamic => value250.destroy();
    }, []);
    let value62: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(false),
      value63: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value64: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        (): Dynamic => {},
      );
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      let current: Dynamic = value9.current;
      if (!current) return;
      let value250: Dynamic = null,
        callback61: Dynamic = (): Dynamic => {
          value62.current || (value63.current = performance.now());
          value62.current = true;
          value250 != null && clearTimeout(value250);
          value250 = setTimeout((): Dynamic => {
            value250 = null;
            value62.current = false;
            value63.current = null;
          }, 280);
        };
      value64.current = callback61;
      current.addEventListener("wheel", callback61, {
        capture: true,
        passive: true,
      });
      return (): Dynamic => {
        value250 != null && clearTimeout(value250);
        current.removeEventListener("wheel", callback61, true);
      };
    }, []);
    let value65: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      onPanZoom,
    );
    value65.current = onPanZoom;
    let value66: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          let value250: Dynamic = value65.current?.(input, options2) === true;
          value250 &&
            (options2.dx !== 0 ||
              options2.dy !== 0 ||
              (options2.pinch && options2.dz !== 0)) &&
            value64.current();
          return value250;
        },
        [],
      ),
      value67: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value68: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      [value69, value70]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      [value71, value72]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      [value73, value74]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      [value75, value76]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      armedTool !== "note" && value76(null);
    }, [armedTool]);
    let [value77, value78]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value79: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(false),
      [value80, value81]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      [value82, value83]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value84: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(onAddPen);
    value84.current = onAddPen;
    let value85: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      armedTool,
    );
    value85.current = armedTool;
    let [value86, value87]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(false),
      value88: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value89: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value90: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (input?: Dynamic): Dynamic => {
          value89.current = input;
          (0, runtime.applyElementRectStyle)(input, value88.current);
        },
        [],
      ),
      value91: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      callback16: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let entry2: Dynamic = camera.get();
        return {
          x: entry2.x + (input - context.left) / entry2.scale,
          y: entry2.y + (options2 - context.top) / entry2.scale,
        };
      },
      callback17: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value250?: Dynamic,
        extra?: Dynamic,
        detail?: Dynamic,
      ): Dynamic =>
        detail
          ? Promise.resolve({
              travelled: false,
            })
          : new Promise((input2?: Dynamic): Dynamic => {
              let flag2: Dynamic = false,
                callback61: Dynamic = (input3?: Dynamic): Dynamic => {
                  input3.pointerId === input &&
                    Math.hypot(
                      input3.clientX - value250,
                      input3.clientY - extra,
                    ) >= runtime.canvasDragThresholdPixels &&
                    (flag2 = true);
                },
                flag3: Dynamic = false,
                callback62: Dynamic = (input3?: Dynamic): Dynamic => {
                  flag3 ||
                    ((flag3 = true),
                    (window as Dynamic).removeEventListener(
                      "pointermove",
                      callback61,
                      true,
                    ),
                    (window as Dynamic).removeEventListener(
                      "pointerup",
                      callback63,
                      true,
                    ),
                    (window as Dynamic).removeEventListener(
                      "pointercancel",
                      callback64,
                      true,
                    ),
                    (window as Dynamic).removeEventListener(
                      "keydown",
                      callback65,
                      true,
                    ),
                    (window as Dynamic).removeEventListener("blur", callback66),
                    (window as Dynamic).removeEventListener(
                      "contextmenu",
                      callback67,
                      true,
                    ),
                    value251?.disconnect(),
                    (window as Dynamic).setTimeout(
                      (): Dynamic =>
                        input2({
                          travelled: flag2 || input3,
                        }),
                      0,
                    ));
                },
                callback63: Dynamic = (input3?: Dynamic): Dynamic => {
                  input3.pointerId === input && callback62(false);
                },
                callback64: Dynamic = (input3?: Dynamic): Dynamic => {
                  input3.pointerId === input && callback62(true);
                },
                callback65: Dynamic = (input3?: Dynamic): Dynamic => {
                  input3.key === "Escape" && (flag2 = true);
                },
                callback66: Dynamic = (): Dynamic => {
                  (document as Dynamic).hasFocus() || callback62(true);
                },
                callback67: Dynamic = (): Dynamic => callback62(true),
                value251: Dynamic =
                  options2 === "mouse"
                    ? null
                    : new MutationObserver((): Dynamic => {
                        !context.isConnected && callback62(false);
                      });
              value251?.observe(value9.current ?? (document as Dynamic).body, {
                childList: true,
                subtree: true,
              });
              (window as Dynamic).addEventListener(
                "pointermove",
                callback61,
                true,
              );
              (window as Dynamic).addEventListener(
                "pointerup",
                callback63,
                true,
              );
              (window as Dynamic).addEventListener(
                "pointercancel",
                callback64,
                true,
              );
              (window as Dynamic).addEventListener("keydown", callback65, true);
              (window as Dynamic).addEventListener("blur", callback66);
              (window as Dynamic).addEventListener(
                "contextmenu",
                callback67,
                true,
              );
            }),
      callback18: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        source?: Dynamic,
      ): Dynamic => {
        let x: Dynamic = source.at.x,
          y: Dynamic = source.at.y;
        onCoverPress?.(options2.file, {
          x: x,
          y: y,
        });
        let entry2: Dynamic = value2.current.get(options2.file),
          callback61: Dynamic = (): Dynamic => {
            if (source.face) {
              value60(options2.file, true);
              return;
            }
            value60(options2.file, source.toggle);
            source.toggle || onFocus(options2.file);
          },
          callback62: Dynamic = (): Dynamic => {
            source.kind !== "set" && callback61();
          };
        if (!entry2 || !entry2.isReady() || !onElementPress) {
          callback62();
          return;
        }
        let currentTarget: Dynamic = input.currentTarget,
          {
            pointerId: value250,
            pointerType: value251,
            clientX: value252,
            clientY: value253,
          }: Dynamic = input,
          value254: Dynamic = onPressIntent?.() ?? 0,
          callback63: Dynamic = (): Dynamic =>
            pressIntentIs ? pressIntentIs(value254) : true,
          value255: Dynamic = source.still === true,
          flag2: Dynamic = false,
          state: Dynamic = {
            x: value252,
            y: value253,
          },
          flag3: Dynamic = false,
          value256: Dynamic = null,
          callback64: Dynamic = (): Dynamic => {
            (window as Dynamic).removeEventListener("pointermove", callback65);
            (window as Dynamic).removeEventListener("pointerup", callback66);
            (window as Dynamic).removeEventListener(
              "pointercancel",
              callback67,
            );
          },
          callback65: Dynamic = (input2?: Dynamic): Dynamic => {
            input2.pointerId === value250 &&
              ((state = {
                x: input2.clientX,
                y: input2.clientY,
              }),
              Math.hypot(
                input2.clientX - value252,
                input2.clientY - value253,
              ) >= runtime.canvasDragThresholdPixels && (flag2 = true));
          },
          callback66: Dynamic = (input2?: Dynamic): Dynamic => {
            if (input2.pointerId !== value250) return;
            value255 = true;
            callback64();
            let value260: Dynamic = value256;
            value256 = null;
            value260 && !flag2 && callback63() && value260();
          },
          callback67: Dynamic = (input2?: Dynamic): Dynamic => {
            input2.pointerId === value250 &&
              ((flag3 = true), (value256 = null), callback64());
          };
        if (!value255) {
          try {
            currentTarget.setPointerCapture(value250);
          } catch {}
          (window as Dynamic).addEventListener("pointermove", callback65);
          (window as Dynamic).addEventListener("pointerup", callback66);
          (window as Dynamic).addEventListener("pointercancel", callback67);
        }
        let callback68: Dynamic = (input2?: Dynamic): Dynamic => {
            value255 ? flag2 || input2() : (value256 = input2);
          },
          value257: Dynamic = value26.current?.[options2.file] ?? [],
          value258: Dynamic = source.deepKey ? "deep" : "plain",
          value259: Dynamic = entry2.pickAt(x, y, value258, value257).then(
            (input2?: Dynamic): Dynamic => {
              if (flag3 || !callback63()) {
                callback64();
                return;
              }
              let callback69: Dynamic = (
                  input3?: Dynamic,
                  options3?: Dynamic,
                ): Dynamic => {
                  if (value255) {
                    flag2 || input3();
                    return;
                  }
                  callback64();
                  callback19(input, {
                    origin: {
                      kind: "artboard",
                      file: options2.file,
                    },
                    mode: value258,
                    toggle: source.toggle,
                    capture: currentTarget,
                    onStillRelease: input3,
                    tree: options3,
                    from: flag2 ? state : undefined,
                  });
                },
                callback70: Dynamic = (): Dynamic => {
                  source.toggle
                    ? value60(options2.file, true)
                    : source.face || callback61();
                };
              if (input2 == null) {
                callback69(callback70);
                return;
              }
              if ("empty" in input2) {
                callback64();
                let value262: Dynamic = (0,
                runtime.selectionPointerDownDecision)(
                  value57.current,
                  {
                    file: options2.file,
                  },
                  source.toggle,
                );
                value262.selectNow && value60(options2.file, source.toggle);
                let value263: Dynamic = Object.assign(Object.create(input), {
                  currentTarget: currentTarget,
                });
                value255
                  ? !flag2 &&
                    value262.click &&
                    onSelectObjects(
                      (0, runtime.boardSelectionItems)({
                        file: options2.file,
                      }),
                      value262.click === "toggle" ? "toggle" : "replace",
                    )
                  : callback46(
                      value263,
                      {
                        file: options2.file,
                      },
                      options2,
                      value262.carry,
                      value262.click,
                      !source.toggle,
                    );
                value255 && !source.toggle && onFocus(options2.file);
                return;
              }
              if (source.toggle && value57.current.files.has(options2.file)) {
                callback68((): Dynamic => value60(options2.file, true));
                return;
              }
              let value260: Dynamic = value257.includes(input2.tid);
              if (input2.root && !value260) {
                callback69((): Dynamic => {
                  source.toggle ||
                    (input2.page
                      ? callback70()
                      : onElementPress(
                          options2.file,
                          input2.tid,
                          input2.rect,
                          "replace",
                          true,
                        ));
                });
                return;
              }
              if (source.deepKey && runtime.InspectorColorPickResolvedValue_2) {
                let value262: Dynamic =
                  value92.current?.(source.toggle) ?? null;
                if (source.toggle && value260) {
                  callback69(
                    (): Dynamic =>
                      onElementPress(
                        options2.file,
                        input2.tid,
                        input2.rect,
                        "remove",
                        false,
                      ),
                    value262,
                  );
                  return;
                }
                onElementPress(
                  options2.file,
                  input2.tid,
                  input2.rect,
                  source.toggle ? "toggle" : "replace",
                  false,
                );
                callback69((): Dynamic => {
                  source.toggle || onArmArtboard?.(options2.file);
                }, value262);
                return;
              }
              if (source.toggle) {
                value260
                  ? callback68(
                      (): Dynamic =>
                        onElementPress(
                          options2.file,
                          input2.tid,
                          input2.rect,
                          "remove",
                          false,
                        ),
                    )
                  : (callback64(),
                    onElementPress(
                      options2.file,
                      input2.tid,
                      input2.rect,
                      "toggle",
                      false,
                    ));
                return;
              }
              if (value260) {
                let value262: Dynamic =
                    value257.length === 1 && input2.text ? input2.text : input2,
                  callback71: Dynamic = (): Dynamic => {
                    onElementPress(
                      options2.file,
                      value262.tid,
                      value262.rect,
                      "narrow",
                      true,
                    );
                  };
                if (onSetMoveCommit && !flag3 && !source.deepKey) {
                  callback64();
                  if (value255) {
                    flag2 || callback71();
                    return;
                  }
                  callback53({
                    pointerId: value250,
                    captureEl: currentTarget,
                    clientX: value252,
                    clientY: value253,
                    leader: {
                      file: options2.file,
                      tid: input2.tid,
                    },
                    stillAction: callback71,
                    armWait: null,
                    heldCover: options2.file,
                    from: flag2
                      ? {
                          clientX: state.x,
                          clientY: state.y,
                        }
                      : null,
                  });
                  return;
                }
                callback68(callback71);
                return;
              }
              let text: Dynamic = input2.text,
                value261: Dynamic = text
                  ? (): Dynamic => {
                      onElementPress(
                        options2.file,
                        text.tid,
                        text.rect,
                        "replace",
                        true,
                      );
                    }
                  : null;
              callback64();
              if (onSetMoveCommit && !value255 && !source.deepKey) {
                value222(options2.file);
                let value262: Dynamic = onElementPress(
                  options2.file,
                  input2.tid,
                  input2.rect,
                  "replace",
                  true,
                );
                callback53({
                  pointerId: value250,
                  captureEl: currentTarget,
                  clientX: value252,
                  clientY: value253,
                  leader: {
                    file: options2.file,
                    tid: input2.tid,
                  },
                  files: new Map([[options2.file, [input2.tid]]]),
                  canvas: runtime.emptyBoardSelection,
                  stillAction: value261,
                  armWait:
                    value262 instanceof Promise
                      ? value262
                      : Promise.resolve(true),
                  heldCover: options2.file,
                  from: flag2
                    ? {
                        clientX: state.x,
                        clientY: state.y,
                      }
                    : null,
                }) || value222(null);
                return;
              }
              value255 && !flag2 && value261
                ? value261()
                : onElementPress(
                    options2.file,
                    input2.tid,
                    input2.rect,
                    "replace",
                    true,
                  );
            },
            (): Dynamic => {
              !flag3 && callback63() && callback62();
            },
          );
        onCoverPick?.(options2.file, value259, {
          gen: value254,
          kind: source.kind ?? "focus",
          ended: callback17(
            value250,
            value251,
            currentTarget,
            value252,
            value253,
            value255,
          ),
        });
        value29.current = value259;
      },
      value92: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        onMarqueeBegin,
      );
    value92.current = onMarqueeBegin;
    let callback19: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let current: Dynamic = value9.current;
        if (!current) return;
        let {
            pointerId: value250,
            clientX: value251,
            clientY: value252,
          }: Dynamic = input,
          value253: Dynamic = callback16(
            value251,
            value252,
            current.getBoundingClientRect(),
          ),
          value254: Dynamic =
            options2.tree !== undefined
              ? options2.tree
              : (value92.current?.(options2.toggle) ?? null),
          current2: Dynamic = value57.current,
          value255: Dynamic = options2.toggle
            ? current2
            : runtime.emptyBoardSelection;
        try {
          options2.capture.hasPointerCapture(value250) ||
            options2.capture.setPointerCapture(value250);
        } catch {}
        value134("marquee", true);
        let value256: Dynamic = null,
          value257: Dynamic = value251,
          value258: Dynamic = value252,
          value259: Dynamic = null,
          index: Dynamic = 0,
          flag2: Dynamic = false,
          entries2: Dynamic = new Map(),
          values: Dynamic = new Set(),
          entries3: Dynamic = new Map(),
          entries4: Dynamic = new Map(),
          values2: Dynamic = new Set(),
          callback61: Dynamic = (
            input2?: Dynamic,
            options3?: Dynamic,
          ): Dynamic => {
            let value260: Dynamic = [
              options3.x0,
              options3.y0,
              options3.x1,
              options3.y1,
            ]
              .map((input3?: Dynamic): Dynamic => Math.round(input3))
              .join(",");
            if (entries4.get(input2) === value260) return true;
            if (values.has(input2)) {
              entries3.set(input2, options3);
              return true;
            }
            let entry2: Dynamic = value2.current.get(input2);
            return !entry2 || !entry2.isReady()
              ? false
              : (values.add(input2),
                entries4.set(input2, value260),
                entry2.pickIn(options3, options2.mode).then(
                  (input3?: Dynamic): Dynamic => {
                    values.delete(input2);
                    if (flag2 || (index && Date.now() - index > 1500)) return;
                    input3 == null
                      ? values2.add(input2)
                      : entries2.set(input2, input3);
                    callback63();
                    let entry3: Dynamic = entries3.get(input2);
                    entries3.delete(input2);
                    entry3 && callback61(input2, entry3);
                  },
                  (): Dynamic => {
                    values.delete(input2);
                    values2.add(input2);
                    !flag2 &&
                      !(index && Date.now() - index > 1500) &&
                      callback63();
                  },
                ),
                true);
          },
          callback62: Dynamic = (input2?: Dynamic): Dynamic => {
            let current3: Dynamic = value146.current,
              values3: Dynamic = new Set(),
              entries5: Dynamic = new Map(),
              value260: Dynamic =
                options2.origin.kind === "canvas"
                  ? current3.artboards
                  : current3.artboards.filter(
                      (input3?: Dynamic): Dynamic =>
                        input3.file === options2.origin.file,
                    );
            for (let value262 of value260 as Dynamic) {
              if (!(0, runtime.inclusiveRectIntersects)(input2, value262)) {
                entries2.delete(value262.file);
                entries3.delete(value262.file);
                entries4.delete(value262.file);
                continue;
              }
              let value263: Dynamic =
                input2.x <= value262.x &&
                value262.x + value262.w <= input2.x + input2.w &&
                input2.y <= value262.y &&
                value262.y + value262.h <= input2.y + input2.h;
              if (
                options2.origin.kind === "canvas" &&
                (value262.frameless || (value263 && options2.mode === "plain"))
              ) {
                values3.add(value262.file);
                entries2.delete(value262.file);
                continue;
              }
              if (
                !(
                  !values2.has(value262.file) &&
                  callback61(value262.file, {
                    x0: Math.max(0, input2.x - value262.x),
                    y0: Math.max(0, input2.y - value262.y),
                    x1: Math.min(value262.w, input2.x + input2.w - value262.x),
                    y1: Math.min(value262.h, input2.y + input2.h - value262.y),
                  })
                )
              ) {
                options2.origin.kind === "canvas" && values3.add(value262.file);
                continue;
              }
              let entry2: Dynamic = entries2.get(value262.file);
              entry2 &&
                entry2.length > 0 &&
                entries5.set(value262.file, {
                  name: (0, runtime.SelectionActionsReplace)(value262.file),
                  tids: entry2,
                });
            }
            let value261: Dynamic =
                value19.current && options2.origin.kind === "canvas"
                  ? (current3.annotations ?? [])
                  : [],
              notes: Dynamic = (0, runtime.objectsWithinCanvasMarquee)(
                {
                  artboards: [],
                  annotations: value261,
                  annBox: value216.current,
                },
                input2,
                runtime.emptyBoardSelection,
              ).notes;
            return {
              files: values3,
              notes: notes,
              elements: entries5,
            };
          },
          callback63: Dynamic = (): Dynamic => {
            if (!value259) return;
            let value260: Dynamic = callback62(value259),
              value261: Dynamic =
                [...value260.files].sort().join(`
`) +
                `

` +
                [...value260.notes].sort().join(`
`) +
                `

` +
                [...value260.elements]
                  .map(
                    ([input2, input3]: Dynamic): Dynamic =>
                      input2 +
                      "#" +
                      [...input3.tids]
                        .sort(
                          (input4?: Dynamic, options3?: Dynamic): Dynamic =>
                            input4 - options3,
                        )
                        .join("."),
                  )
                  .sort().join(`
`);
            value261 !== value256 &&
              ((value256 = value261),
              value254
                ? value254.sweep(value260)
                : value61.current(
                    {
                      files: new Set([...value255.files, ...value260.files]),
                      notes: new Set([...value255.notes, ...value260.notes]),
                    },
                    "replace",
                  ));
          },
          callback64: Dynamic = (): Dynamic => {
            let value260: Dynamic = callback16(
              value257,
              value258,
              current.getBoundingClientRect(),
            );
            value259 = {
              x: Math.min(value253.x, value260.x),
              y: Math.min(value253.y, value260.y),
              w: Math.abs(value260.x - value253.x),
              h: Math.abs(value260.y - value253.y),
            };
            let entry2: Dynamic = value34.current.get();
            value88.current = {
              x: (value259.x - entry2.x) * entry2.scale,
              y: (value259.y - entry2.y) * entry2.scale,
              w: value259.w * entry2.scale,
              h: value259.h * entry2.scale,
            };
            (0, runtime.applyElementRectStyle)(
              value89.current,
              value88.current,
            );
            callback63();
          };
        value91.current = (): Dynamic => {
          value256 != null && callback64();
        };
        let callback65: Dynamic = (input2?: Dynamic): Dynamic => {
            if (input2.pointerId === value250) {
              if (!(input2.buttons & 1)) return callback66();
              if (value256 == null) {
                if (
                  Math.hypot(
                    input2.clientX - value251,
                    input2.clientY - value252,
                  ) < runtime.canvasDragThresholdPixels
                )
                  return;
                value87(true);
              }
              value257 = input2.clientX;
              value258 = input2.clientY;
              callback64();
            }
          },
          callback66: Dynamic = (): Dynamic => {
            index = Date.now();
            (window as Dynamic).removeEventListener("pointermove", callback65);
            (window as Dynamic).removeEventListener("pointerup", callback68);
            (window as Dynamic).removeEventListener(
              "pointercancel",
              callback69,
            );
            (window as Dynamic).removeEventListener(
              "keydown",
              callback70,
              true,
            );
            (window as Dynamic).removeEventListener("blur", callback67);
            (window as Dynamic).removeEventListener("contextmenu", callback66);
            value91.current = null;
            value88.current = null;
            value87(false);
            value134("marquee", false);
          },
          callback67: Dynamic = (): Dynamic => {
            (document as Dynamic).hasFocus() || ((flag2 = true), callback66());
          },
          callback68: Dynamic = (input2?: Dynamic): Dynamic => {
            if (input2.pointerId !== value250) return;
            let value260: Dynamic = value256 == null;
            callback66();
            value260 && options2.onStillRelease?.();
          },
          callback69: Dynamic = (input2?: Dynamic): Dynamic => {
            input2.pointerId === value250 && ((flag2 = true), callback66());
          },
          callback70: Dynamic = (event?: Dynamic): Dynamic => {
            event.key !== "Escape" ||
              value256 == null ||
              (event.preventDefault(),
              event.stopPropagation(),
              (flag2 = true),
              callback66(),
              value254
                ? value254.cancel()
                : value61.current(current2, "replace"));
          };
        (window as Dynamic).addEventListener("pointermove", callback65);
        (window as Dynamic).addEventListener("pointerup", callback68);
        (window as Dynamic).addEventListener("pointercancel", callback69);
        (window as Dynamic).addEventListener("keydown", callback70, true);
        (window as Dynamic).addEventListener("blur", callback67);
        (window as Dynamic).addEventListener("contextmenu", callback66);
        options2.from &&
          (value87(true),
          (value257 = options2.from.x),
          (value258 = options2.from.y),
          callback64());
      },
      value93: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          if (options2.type === "drop") {
            let value250: Dynamic = value146.current.artboards.find(
                (input2?: Dynamic): Dynamic => input2.file === input,
              ),
              value251: Dynamic = value9.current?.getBoundingClientRect();
            if (value250 && value251) {
              let entry2: Dynamic = camera.get(),
                value252: Dynamic =
                  (value250.x + options2.x - entry2.x) * entry2.scale +
                  value251.left,
                value253: Dynamic =
                  (value250.y + options2.y - entry2.y) * entry2.scale +
                  value251.top;
              if (
                value252 < value251.left ||
                value252 > value251.right ||
                value253 < value251.top ||
                value253 > value251.bottom
              ) {
                onDragEvent?.(input, {
                  type: "cancel",
                  key: options2.key,
                });
                return;
              }
            }
          }
          onDragEvent?.(input, options2);
        },
        [onDragEvent, camera],
      ),
      value94: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(onHostDrag);
    value94.current = onHostDrag;
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      if (streamDragFile == null) return;
      let callback61: Dynamic = (input?: Dynamic): Dynamic => {
          let value250: Dynamic = value9.current?.getBoundingClientRect();
          return value250
            ? callback16(input.clientX, input.clientY, value250)
            : null;
        },
        callback62: Dynamic = (): Dynamic =>
          value94.current?.("cancel", 0, 0, false),
        callback63: Dynamic = (input?: Dynamic): Dynamic => {
          input.pointerType === "mouse" &&
            value94.current?.("stale", 0, 0, false);
        },
        callback64: Dynamic = (input?: Dynamic): Dynamic => {
          if (input.pointerType !== "mouse") return;
          if (!(input.buttons & 1)) {
            callback62();
            return;
          }
          let value250: Dynamic = callback61(input);
          value250 &&
            value94.current?.(
              "move",
              value250.x,
              value250.y,
              input.altKey,
              input.ctrlKey,
            );
        },
        callback65: Dynamic = (event?: Dynamic): Dynamic => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          let value250: Dynamic = callback61(event),
            value251: Dynamic =
              !!value9.current &&
              event.target instanceof Node &&
              value9.current.contains(event.target);
          value250 && value251
            ? value94.current?.(
                "up",
                value250.x,
                value250.y,
                event.altKey,
                event.ctrlKey,
              )
            : callback62();
        };
      (window as Dynamic).addEventListener("pointerdown", callback63, true);
      (window as Dynamic).addEventListener("pointermove", callback64, true);
      (window as Dynamic).addEventListener("pointerup", callback65, true);
      (window as Dynamic).addEventListener("pointercancel", callback62, true);
      (window as Dynamic).addEventListener("blur", callback62);
      return (): Dynamic => {
        (window as Dynamic).removeEventListener(
          "pointerdown",
          callback63,
          true,
        );
        (window as Dynamic).removeEventListener(
          "pointermove",
          callback64,
          true,
        );
        (window as Dynamic).removeEventListener("pointerup", callback65, true);
        (window as Dynamic).removeEventListener(
          "pointercancel",
          callback62,
          true,
        );
        (window as Dynamic).removeEventListener("blur", callback62);
      };
    }, [streamDragFile]);
    let callback20: Dynamic = (event?: Dynamic): Dynamic =>
        event.target instanceof Node &&
        event.currentTarget.contains(event.target),
      {
        held: value95,
        heldRef: value96,
        claimPan: value97,
      }: Dynamic = (0, runtime.useSpacePanKeyboard)(),
      [value98, value99]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value100: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null);
    (0, runtime.reactVectorToolState_2.useEffect)(
      (): Dynamic => (): Dynamic => value100.current?.release(),
      [],
    );
    let callback21: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        value100.current?.release();
        let callback61: Dynamic = (): Dynamic => {
            (window as Dynamic).removeEventListener(
              "pointermove",
              callback62,
              true,
            );
            (window as Dynamic).removeEventListener(
              "pointerout",
              callback62,
              true,
            );
            value100.current = null;
          },
          callback62: Dynamic = (event?: Dynamic): Dynamic => {
            let value250: Dynamic =
              event.type !== "pointerout"
                ? event.target
                : event.relatedTarget instanceof HTMLIFrameElement
                  ? event.relatedTarget
                  : null;
            (event.type === "pointerout"
              ? event.relatedTarget != null && value250 == null
              : (0, runtime.isAboveTitleRect)(
                  event.clientX,
                  event.clientY,
                  input.getBoundingClientRect(),
                )) ||
              (callback61(),
              value99(
                value250 instanceof Element
                  ? (value250
                      .closest("[data-mega-artboard]")
                      ?.getAttribute("data-mega-artboard") ?? null)
                  : null,
              ));
          };
        (window as Dynamic).addEventListener("pointermove", callback62, true);
        (window as Dynamic).addEventListener("pointerout", callback62, true);
        value100.current = {
          el: input,
          file: options2,
          release: callback61,
        };
      },
      callback22: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let current: Dynamic = value100.current;
        return (
          current != null &&
          current.file !== options2 &&
          (0, runtime.isAboveTitleRect)(
            input.clientX,
            input.clientY,
            current.el.getBoundingClientRect(),
          )
        );
      },
      [value101, value102]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(new Map()),
      value103: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Map()),
      callback23: Dynamic = (input?: Dynamic): Dynamic => {
        let entry2: Dynamic = value103.current.get(input);
        entry2 ||
          ((entry2 = (input2?: Dynamic): Dynamic =>
            value102((input3?: Dynamic): Dynamic => {
              if ((input3.get(input) ?? null) === input2) return input3;
              let entries2: Dynamic = new Map(input3);
              input2 ? entries2.set(input, input2) : entries2.delete(input);
              return entries2;
            })),
          value103.current.set(input, entry2));
        return entry2;
      },
      [value104, value105]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value106: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(false),
      callback24: Dynamic = (input?: Dynamic): Dynamic => {
        value106.current = false;
        value105(input);
      };
    renameRef && (renameRef.current = callback24);
    let value107: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          options2.keyboard !== true &&
            (value148.current = {
              x: options2.x,
              y: options2.y,
              inFrame: false,
            });
          onCanvasMenu?.(input, options2);
        },
      ),
      [value108]: Dynamic = (0, runtime.reactVectorToolState_2.useState)(
        (): Dynamic =>
          (0, runtime.createDeferredPointerClick)(
            (input?: Dynamic, options2?: Dynamic): Dynamic =>
              value107(options2, input),
          ),
      ),
      value109: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      let callback61: Dynamic = (event?: Dynamic): Dynamic => {
        value109.current =
          event.button === 2 &&
          event.target instanceof Element &&
          event.target.hasAttribute("data-mc-scrim")
            ? {
                x: event.clientX,
                y: event.clientY,
              }
            : null;
      };
      (window as Dynamic).addEventListener("pointerdown", callback61, true);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener(
          "pointerdown",
          callback61,
          true,
        );
    }, []);
    let [value110, value111]: Dynamic = (0,
    runtime.reactVectorToolState_2.useState)(null);
    value110 &&
      !manifest.artboards.some(
        (input?: Dynamic): Dynamic => input.file === value110.file,
      ) &&
      value111(null);
    let [value112, value113]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      [value114, value115]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value116: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(value114);
    value116.current = value114;
    let value117: Dynamic = (0, runtime.useActiveCropElement)(),
      [, value118]: Dynamic = (0, runtime.reactVectorToolState_2.useState)(0),
      value119: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (): Dynamic => value118((input?: Dynamic): Dynamic => input + 1),
        [],
      ),
      callback25: Dynamic = (input?: Dynamic): Dynamic => {
        let value250: Dynamic = value9.current?.querySelector(
            '[data-testid="mega-shape-body-' + input + '"]',
          ),
          value251: Dynamic = value250?.matches("img, video")
            ? value250
            : value250?.querySelector("img, video");
        return value250 &&
          value251 &&
          value251.dataset.megaPicture === "" &&
          (0, runtime.mediaNaturalDimensions)(value251)
          ? {
              img: value251,
              body: value250,
            }
          : null;
      },
      callback26: Dynamic = (input?: Dynamic): Dynamic =>
        input.local.x !== 0 ||
        input.local.y !== 0 ||
        input.local.w !== input.pad0.w ||
        input.local.h !== input.pad0.h,
      callback27: Dynamic = (input?: Dynamic): Dynamic => {
        if (!callback26(input)) return null;
        let value250: Dynamic = (0, runtime.rotatedCropFrame)(
          input.pad0,
          (input.rot * Math.PI) / 180,
          input.local,
        );
        return {
          x: value250.x - input.edge.l,
          y: value250.y - input.edge.t,
          w: value250.w + input.edge.l + input.edge.r,
          h: value250.h + input.edge.t + input.edge.b,
        };
      },
      callback28: Dynamic = (input?: Dynamic): Dynamic => {
        if (!callback25(input)) return;
        let value250: Dynamic = (value146.current.annotations ?? []).find(
          (input2?: Dynamic): Dynamic => input2.id === input,
        );
        if (value250 && (0, runtime.imageFlipCss)(value250))
          return void onSetMoveSay?.(runtime.CropDoesNotWorkWhileThisMessage);
        (0, runtime.reactDomVectorToolState.flushSync)(runtime.blurBeforeCrop);
        let value251: Dynamic = (value146.current.annotations ?? []).find(
            (input2?: Dynamic): Dynamic => input2.id === input,
          ),
          value252: Dynamic = callback25(input);
        if (value251?.kind !== "image" || !value252) return;
        let value253: Dynamic = (0, runtime.mediaNaturalDimensions)(
            value252.img,
          ),
          state: Dynamic = {
            l: value252.body.clientLeft,
            t: value252.body.clientTop,
            r:
              value251.w - value252.body.clientLeft - value252.body.clientWidth,
            b:
              value251.h - value252.body.clientTop - value252.body.clientHeight,
          },
          state2: Dynamic = {
            x: 0,
            y: 0,
            w: value252.body.clientWidth,
            h: value252.body.clientHeight,
          },
          value254: Dynamic = getComputedStyle(value252.img),
          value255: Dynamic =
            value251.crop ??
            (0, runtime.cropFromObjectStyles)(state2, value253, {
              fit: value254.objectFit,
              pos: (0, runtime.parseObjectPosition)(value254.objectPosition),
              box: null,
            });
        value115({
          id: input,
          src: value251.src,
          natural: value253,
          rot: (0, runtime.annotationRotation)(value251),
          pad0: {
            x: value251.x + state.l,
            y: value251.y + state.t,
            w: state2.w,
            h: state2.h,
          },
          edge: state,
          local: state2,
          live: value255,
          before: value255,
        });
      },
      value120: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value116.current;
          if (!current) return;
          value116.current = null;
          value115(null);
          let value250: Dynamic = (value146.current.annotations ?? []).find(
              (input2?: Dynamic): Dynamic => input2.id === current.id,
            ),
            value251: Dynamic = (0, runtime.normalizeCenteredImageCrop)(
              current.local,
              current.natural,
              current.live,
            ),
            value252: Dynamic = callback26(current);
          if (
            !input ||
            value250?.kind !== "image" ||
            value250.src !== current.src ||
            (!value252 &&
              (0, runtime.sameImageCrop)(
                value251,
                (0, runtime.normalizeCenteredImageCrop)(
                  current.pad0,
                  current.natural,
                  current.before,
                ),
              ))
          )
            return;
          let { "object-position": value253, ...value254 }: Dynamic =
              value250.css ?? {},
            value255: Dynamic = callback27(current);
          callback34(
            current.id,
            (source?: Dynamic): Dynamic =>
              source.kind === "image"
                ? (0, runtime.updateAnnotationCrop)(
                    {
                      ...(0, runtime.updateAnnotationCss)(source, {
                        ...value254,
                        "object-fit": "cover",
                      }),
                      ...value255,
                    },
                    value251,
                  )
                : source,
            true,
          );
          (0, runtime.announce)(
            value251 || value252 ? "Cropped." : "Crop removed.",
          );
        },
      ),
      value121: Dynamic = value114
        ? (manifest.annotations ?? []).find(
            (input?: Dynamic): Dynamic => input.id === value114.id,
          )
        : undefined,
      value122: Dynamic =
        value114 !== null &&
        (!value18 ||
          value121?.kind !== "image" ||
          value121.src !== value114.src),
      value123: Dynamic =
        value114 !== null &&
        (value59 !== value114.id ||
          (0, runtime.supportsClickPlacement)(armedTool) ||
          armedTool === "draw" ||
          fullscreenFile != null);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      value122 ? value120(false) : value123 && value120(true);
    }, [value122, value123, value120]);
    let [value124, value125]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(false),
      [value126, value127]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(false),
      value128: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(value126);
    value128.current = value126;
    let value129: Dynamic = value95 || (armedTool === "hand" && !value126),
      value130: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Set()),
      value131: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(false),
      value132: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        onHostGesturing,
      );
    value132.current = onHostGesturing;
    let callback29: Dynamic = (): Dynamic => {
        let value250: Dynamic = value130.current.size > 0 || value131.current;
        value9.current?.toggleAttribute("data-mega-frames-inert", value250);
        value132.current?.(value250);
      },
      value133: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value134: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          let current: Dynamic = value130.current;
          options2 &&
            current.size === 0 &&
            (value133.current = performance.now());
          options2 ? current.add(input) : current.delete(input);
          current.size === 0 && (value133.current = null);
          value125(current.size > 0);
          callback29();
        },
      ),
      value135: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (
          input?: Dynamic,
          options2?: Dynamic,
          context?: Dynamic,
          value250?: Dynamic,
        ): Dynamic => {
          value130.current.size > 0 ||
            (value250 && !context && (document as Dynamic).hasFocus()) ||
            (0, runtime.schedulePrimaryModifierHeld)(context);
        },
        [],
      ),
      callback30: Dynamic = (
        input?: Dynamic,
        options2: Dynamic = 0,
      ): Dynamic => {
        let callback61: Dynamic = (input2?: Dynamic): Dynamic => {
          options2 === 2 && value108.move(input2);
          input2.pointerType !== "touch" &&
            (input2.buttons & options2) === 0 &&
            callback62(input2);
        };
        options2 === 2 && (0, runtime.suppressNativeContextMenu)(true);
        let callback62: Dynamic = (input2?: Dynamic): Dynamic => {
          (window as Dynamic).removeEventListener("pointerup", callback62);
          (window as Dynamic).removeEventListener("pointercancel", callback62);
          options2 &&
            (window as Dynamic).removeEventListener("pointermove", callback61);
          options2 === 2 && (0, runtime.suppressNativeContextMenu)(false);
          options2 === 2 && value108.end(input2.type !== "pointercancel");
          value134(input, false);
          input === "pan" &&
            value9.current?.removeAttribute("data-mega-grabbing");
          input === "frame-drag" && value218.current(input2.pointerId);
        };
        (window as Dynamic).addEventListener("pointerup", callback62);
        (window as Dynamic).addEventListener("pointercancel", callback62);
        options2 &&
          (window as Dynamic).addEventListener("pointermove", callback61);
      };
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      let callback61: Dynamic = (input?: Dynamic): Dynamic => {
          value131.current = input;
          callback29();
        },
        callback62: Dynamic = (): Dynamic => callback61(false),
        callback63: Dynamic = (input?: Dynamic): Dynamic => {
          input.pointerType === "mouse" &&
            input.button === 0 &&
            callback61(true);
        },
        callback64: Dynamic = (): Dynamic => {
          (document as Dynamic).hasFocus() || callback62();
        };
      (window as Dynamic).addEventListener("pointerdown", callback63, true);
      (window as Dynamic).addEventListener("pointerup", callback62, true);
      (window as Dynamic).addEventListener("pointercancel", callback62, true);
      (window as Dynamic).addEventListener("contextmenu", callback62, true);
      (window as Dynamic).addEventListener("blur", callback64);
      return (): Dynamic => {
        (window as Dynamic).removeEventListener(
          "pointerdown",
          callback63,
          true,
        );
        (window as Dynamic).removeEventListener("pointerup", callback62, true);
        (window as Dynamic).removeEventListener(
          "pointercancel",
          callback62,
          true,
        );
        (window as Dynamic).removeEventListener(
          "contextmenu",
          callback62,
          true,
        );
        (window as Dynamic).removeEventListener("blur", callback64);
      };
    }, []);
    let [value136, value137]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(false),
      value138: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value139: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          input === focusedFile &&
            (value138.current != null && clearTimeout(value138.current),
            (value138.current = options2
              ? setTimeout((): Dynamic => value137(false), 1e4)
              : null),
            value137(options2));
        },
      );
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      value137(false);
      value138.current != null &&
        (clearTimeout(value138.current), (value138.current = null));
    }, [focusedFile]);
    let [value140, value141]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value142: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          input === focusedFile && value141(options2);
        },
      );
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      value141(null);
    }, [focusedFile]);
    (0, runtime.reactVectorToolState_2.useLayoutEffect)((): Dynamic => {
      for (let value250 of (value9.current?.querySelectorAll(
        "[data-mega-selection-strip]",
      ) ?? []) as Dynamic)
        (0, runtime.getSessionStripScrollRow)(value250).scrollLeft = 0;
    }, [elementSelection?.identity, value59, value140 != null, value112]);
    let value143: Dynamic = (0, runtime.reactVectorToolState_2.useId)(),
      value144: Dynamic = keyboard2?.inside ?? null,
      value145: Dynamic = (0, runtime.useLatestCallback)(
        (): Dynamic =>
          (armedTool != null && armedTool !== "select") || value136,
      );
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      let callback61: Dynamic = (event?: Dynamic): Dynamic => {
        event.key !== "Escape" ||
          !event.repeat ||
          (event.target instanceof Element &&
            event.target.hasAttribute("data-mega-title-text") &&
            event.preventDefault());
      };
      (window as Dynamic).addEventListener("keydown", callback61, true);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("keydown", callback61, true);
    }, []);
    let value146: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      manifest,
    );
    value146.current = manifest;
    let value147: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        new Map(),
      ),
      callback31: Dynamic = (input?: Dynamic): Dynamic => {
        let entry2: Dynamic = value147.current.get(input.file);
        if (entry2 && entry2.w === input.w && entry2.h === input.h)
          return entry2;
        let state: Dynamic = {
          w: input.w,
          h: input.h,
        };
        value147.current.set(input.file, state);
        return state;
      },
      value148: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value149: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      callback32: Dynamic = (event?: Dynamic): Dynamic => {
        let value250: Dynamic =
            event.target instanceof Element &&
            event.target.tagName === "IFRAME",
          value251: Dynamic = value250
            ? (event.target.closest("[data-mega-artboard]")?.dataset
                .megaArtboard ?? null)
            : null;
        value149.current = null;
        value148.current =
          event.pointerType !== "touch" && callback20(event)
            ? {
                x: event.clientX,
                y: event.clientY,
                inFrame: value250,
                frameFile: value251,
              }
            : null;
      },
      callback33: Dynamic = (): Dynamic => {
        let current: Dynamic = value148.current;
        current &&
          !current.inFrame &&
          (value148.current = {
            ...current,
            inFrame: true,
            stale: true,
          });
        value32();
      },
      value150: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => onOpenTweaks?.(input),
      ),
      value151: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => onToggleTweaks?.(input),
      ),
      value152: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => onOpenFile?.(input),
      ),
      value153: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          onPreviewDropNotice(input, options2),
      ),
      value154: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => onExpandArtboard?.(input),
      ),
      value155: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => onShowProblems?.(input),
      ),
      value156: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => {
          value21 &&
            ((document as Dynamic).activeElement instanceof HTMLElement &&
              (document as Dynamic).activeElement.blur(),
            value44(input));
          value154(input);
        },
      ),
      value157: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => {
          value56.current !== input
            ? onPlayArtboard?.(input)
            : value22
              ? onFocus(input)
              : onPlayArtboard?.(null);
        },
      ),
      value158: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          value60(input, options2);
          value22 &&
            !callback2(input) &&
            !options2 &&
            !artboardPicking &&
            value56.current !== input &&
            onFocus(input);
        },
      ),
      value159: Dynamic = quickProps?.seed ?? null,
      value160: Dynamic = JSON.stringify(
        value159,
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          typeof options2 == "function"
            ? undefined
            : options2 instanceof Set
              ? [...options2].sort()
              : options2 instanceof Map
                ? [...options2.entries()]
                : options2,
      ),
      value161: Dynamic = (0, runtime.reactVectorToolState_2.useRef)({
        key: value160,
        seed: value159,
      });
    value161.current.key !== value160 &&
      (value161.current = {
        key: value160,
        seed: value159,
      });
    let seed: Dynamic = value161.current.seed,
      value162: Dynamic = (0, runtime.useLatestCallback)(
        (): Dynamic => actionsRef.current?.openProps(),
      ),
      value163: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          quickProps?.onApply(input, options2) ?? Promise.resolve(false),
      ),
      value164: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => quickProps?.onGesture(input),
      ),
      value165: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic): Dynamic => onTextFormat?.(input),
      ),
      value166: Dynamic = (0, runtime.useLatestCallback)(
        (...input: Dynamic[]): Dynamic => quickProps?.onEditText?.(...input),
      ),
      value167: Dynamic = (0, runtime.useLatestCallback)(
        (...input: Dynamic[]): Dynamic =>
          quickProps?.onReplaceImage?.(...input),
      ),
      value168: Dynamic = (0, runtime.useLatestCallback)(
        (): Dynamic => quickProps?.onCrop?.(),
      ),
      value169: Dynamic = (0, runtime.useLatestCallback)(
        (): Dynamic => quickProps?.onReplaceVideo?.(),
      ),
      value170: Dynamic = (0, runtime.useLatestCallback)(
        (): Dynamic => quickProps?.findVideo?.() ?? null,
      ),
      value171: Dynamic = (0, runtime.useLatestCallback)(
        (...input: Dynamic[]): Dynamic => quickProps?.onElementLink?.(...input),
      ),
      value172: Dynamic = (0, runtime.useLatestCallback)(
        (...input: Dynamic[]): Dynamic => value7?.(...input),
      ),
      value173: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          value111(
            options2
              ? {
                  file: input,
                  open: true,
                }
              : (input2?: Dynamic): Dynamic =>
                  input2 && {
                    ...input2,
                    open: false,
                  },
          ),
      ),
      value174: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          options2 && value182.current === input && callback33();
        },
      ),
      value175: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          value182.current === input &&
            (value149.current = {
              file: input,
              ...options2,
            });
        },
      ),
      value176: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value148.current,
            current2: Dynamic = value9.current;
          if (
            !current ||
            current.inFrame ||
            !current2 ||
            value55.current != null ||
            value96.current ||
            callback11()
          )
            return null;
          let value250: Dynamic = (document as Dynamic).elementFromPoint(
            current.x,
            current.y,
          );
          if (!(value250 instanceof Element) || !current2.contains(value250))
            return null;
          let ancestor: Dynamic = value250.closest("[data-mega-artboard]"),
            value251: Dynamic = ancestor?.dataset.megaArtboard ?? null;
          value251 != null &&
            value251 !== value183.current &&
            value146.current.artboards.some(
              (input2?: Dynamic): Dynamic =>
                input2.file === value251 && input2.frameless,
            ) &&
            (value251 = null);
          let value252: Dynamic =
            ancestor == null &&
            value250.closest(
              '[data-mega-chrome="annotation"], [data-mega-chrome="picture-pending"]',
            ) != null;
          if (
            (ancestor == null &&
              !value252 &&
              value250.closest("[data-mega-chrome]") != null &&
              value250.getAttribute("data-mega-chrome") !== "set-box-pad") ||
            (value251 != null &&
              (0, runtime.insertionPointerMatchesContent)(
                input,
                value251,
                value182.current,
                value56.current,
              ))
          )
            return null;
          let value253: Dynamic = callback16(
            current.x,
            current.y,
            current2.getBoundingClientRect(),
          );
          if (value251 == null)
            return value252
              ? {
                  x: value253.x,
                  y: value253.y,
                  file: null,
                  overAnnotation: value252,
                }
              : {
                  x: value253.x,
                  y: value253.y,
                  file: null,
                };
          let value254: Dynamic = value146.current.artboards.find(
            (input2?: Dynamic): Dynamic => input2.file === value251,
          );
          return value254
            ? {
                ...(0, runtime.clampPointToRect)(value253, value254),
                file: value251,
              }
            : null;
        },
        [],
      ),
      value177: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (): Dynamic => value176("content"),
        [value176],
      ),
      value178: Dynamic = (0,
      runtime.reactVectorToolState_2.useCallback)((): Dynamic => {
        let current: Dynamic = value148.current,
          current2: Dynamic = value9.current,
          current3: Dynamic = value182.current;
        if (
          !current ||
          !current2 ||
          !value23.current ||
          value55.current != null ||
          value96.current ||
          callback11()
        )
          return (0, runtime.pointerCoordinates)(value176("artboards"));
        let value250: Dynamic = current.inFrame
            ? null
            : (document as Dynamic).elementFromPoint(current.x, current.y),
          value251: Dynamic = (0, runtime.resolveInsertionPointer)(
            current,
            value149.current,
            current3,
            value250?.tagName === "IFRAME" &&
              value250.closest("[data-mega-artboard]")?.dataset.megaArtboard ===
                current3,
          ),
          value252: Dynamic =
            value251 &&
            value146.current.artboards.find(
              (input?: Dynamic): Dynamic => input.file === current3,
            );
        if (!value251 || !value252)
          return (0, runtime.pointerCoordinates)(value176("artboards"));
        let bounds: Dynamic = current2.getBoundingClientRect(),
          entry2: Dynamic = camera.get(),
          callback61: Dynamic = (input?: Dynamic): Dynamic => {
            let value253: Dynamic = (0, runtime.clampPointToRect)(
                callback16(input.x, input.y, bounds),
                value252,
              ),
              [items, items2]: Dynamic = [
                bounds.left + (value253.x - entry2.x) * entry2.scale,
                bounds.top + (value253.y - entry2.y) * entry2.scale,
              ];
            return items < bounds.left ||
              items > bounds.right ||
              items2 < bounds.top ||
              items2 > bounds.bottom
              ? null
              : value253;
          };
        return (
          callback61(value251) ??
          (value251 === current ? null : callback61(current))
        );
      }, [value176]);
    options.pastePointRef && (options.pastePointRef.current = value177);
    options.artboardLandingRef &&
      (options.artboardLandingRef.current = value178);
    let value179: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (input?: Dynamic, options2?: Dynamic, context?: Dynamic): Dynamic => {
          if (!onImageDrop) return false;
          let value250: Dynamic = navigator.userActivation?.isActive
            ? value177()
            : null;
          if (value250) {
            let current: Dynamic = value57.current,
              value254: Dynamic =
                value250.file == null &&
                current.notes.size === 0 &&
                current.files.size === 1
                  ? value146.current.artboards.find(
                      (input2?: Dynamic): Dynamic =>
                        current.files.has(input2.file) && !input2.frameless,
                    )
                  : undefined;
            if (value254) {
              let value255: Dynamic = value9.current?.getBoundingClientRect(),
                value256: Dynamic = (0, runtime.visibleArtboardCenter)(
                  value254,
                  value55.current == null && value255
                    ? {
                        ...camera.get(),
                        width: value255.width,
                        height: value255.height,
                      }
                    : null,
                );
              onImageDrop(
                options2,
                value256.x,
                value256.y,
                "pasted",
                value254.file,
              );
            } else
              onImageDrop(
                options2,
                value250.x,
                value250.y,
                "pasted",
                value250.file ?? undefined,
              );
            return true;
          }
          if (context.selection) return false;
          let value251: Dynamic = value146.current.artboards.find(
            (input2?: Dynamic): Dynamic => input2.file === input,
          );
          if (!value251) return false;
          let value252: Dynamic = value9.current?.getBoundingClientRect(),
            value253: Dynamic = (0, runtime.visibleArtboardCenter)(
              value251,
              value55.current == null && value252
                ? {
                    ...camera.get(),
                    width: value252.width,
                    height: value252.height,
                  }
                : null,
            );
          onImageDrop(
            options2,
            value253.x,
            value253.y,
            "pasted",
            value251.file,
          );
          return true;
        },
        [onImageDrop, value177, camera],
      ),
      value180: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (input?: Dynamic, options2?: Dynamic, context?: Dynamic): Dynamic => {
          let value250: Dynamic = value146.current.artboards.find(
            (input2?: Dynamic): Dynamic => input2.file === input,
          );
          if (!onImageDrop || !value250) return;
          let value251: Dynamic = value9.current?.getBoundingClientRect(),
            value252: Dynamic = context.at
              ? {
                  x: value250.x + context.at.x,
                  y: value250.y + context.at.y,
                }
              : (0, runtime.visibleArtboardCenter)(
                  value250,
                  value55.current == null && value251
                    ? {
                        ...camera.get(),
                        width: value251.width,
                        height: value251.height,
                      }
                    : null,
                );
          onImageDrop(
            options2,
            value252.x,
            value252.y,
            context.verb,
            value250.file,
            context.at ?? undefined,
            context.after,
          );
        },
        [onImageDrop, camera],
      ),
      value181: Dynamic = (0, runtime.reactVectorToolState_2.useCallback)(
        (input?: Dynamic): Dynamic =>
          (0, runtime.resolveImagePreviewUrl)(input, doc.content().files),
        [doc],
      ),
      callback34: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let current: Dynamic = value146.current;
        onManifestChange(
          {
            ...current,
            annotations: (current.annotations ?? []).map(
              (input2?: Dynamic): Dynamic =>
                input2.id === input ? options2(input2) : input2,
            ),
          },
          context,
        );
      },
      value182: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        focusedFile,
      );
    value182.current = focusedFile;
    let value183: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      enteredFile,
    );
    value183.current = enteredFile;
    let value184: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      livePins,
    );
    value184.current = livePins;
    let value185: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
      inUseFiles,
    );
    value185.current = inUseFiles;
    let value186: Dynamic = (0, runtime.reactVectorToolState_2.useRef)([]),
      [value187]: Dynamic = (0, runtime.reactVectorToolState_2.useState)(
        runtime.maxInteractivePreviews,
      ),
      [value188]: Dynamic = (0, runtime.reactVectorToolState_2.useState)(
        runtime.maxMountedPreviews,
      ),
      [value189, value190]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(
        (): Dynamic => (0, runtime.getLinkedArtboards)(doc.content().files),
      ),
      value191: Dynamic = (0, runtime.reactVectorToolState_2.useRef)({}),
      value192: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(undefined),
      callback35: Dynamic = (): Dynamic => {
        clearTimeout(value192.current);
        value192.current = setTimeout((): Dynamic => {
          value192.current = undefined;
          let value250: Dynamic = (0, runtime.getLinkedArtboards)({
            ...doc.content().files,
            ...value191.current,
          });
          value190(
            (input?: Dynamic): Dynamic =>
              (0, runtime.samePreviewFiles)(input, value250) ? input : value250,
          );
        }, 150);
      };
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      value191.current = {};
      callback35();
      let value250: Dynamic = doc.subscribe((): Dynamic => {
        value191.current = {};
        value41.current.clear();
        callback35();
      });
      return (): Dynamic => {
        value250();
        clearTimeout(value192.current);
        value192.current = undefined;
      };
    }, [doc]);
    (0, runtime.npm_useEventListener_bc)(
      "dc-update",
      (input?: Dynamic): Dynamic => {
        let value250: Dynamic = (0, runtime.resolveComponentFile)(
          doc.content().files,
          input.detail,
        );
        value250 != null &&
          ((value191.current[value250] = input.detail.content), callback35());
      },
    );
    let value193: Dynamic = (0, runtime.reactVectorToolState_2.useMemo)(
        (): Dynamic =>
          outlineArtboards
            ? {
                ...outlineArtboards,
                components: value189,
              }
            : null,
        [outlineArtboards, value189],
      ),
      callback36: Dynamic = (input?: Dynamic): Dynamic => {
        let value250: Dynamic = value186.current.filter(
          (input2?: Dynamic): Dynamic => input2 !== input,
        );
        value250.unshift(input);
        value186.current = value250.slice(0, value188);
      },
      value194: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Set()),
      value195: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(new Map()),
      value196: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(undefined),
      value197: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(undefined),
      value198: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      callback37: Dynamic = (): Dynamic => {
        let entry2: Dynamic = value34.current.get(),
          current: Dynamic = value9.current,
          value250: Dynamic = current?.clientWidth || 1200,
          value251: Dynamic = current?.clientHeight || 800,
          value252: Dynamic = current
            ? (0, runtime.toolbarOverlayHeight)(current)
            : 0;
        return {
          x: entry2.x,
          y: entry2.y + value252 / entry2.scale,
          w: value250 / entry2.scale,
          h: (value251 - value252) / entry2.scale,
        };
      };
    (0, runtime.reactVectorToolState_2.useLayoutEffect)(
      (): Dynamic => (
        runtime.artboardBootScheduler.configure({
          busySince: (): Dynamic => {
            let current: Dynamic = value63.current,
              current2: Dynamic = value133.current;
            return current == null
              ? current2
              : current2 == null
                ? current
                : Math.min(current, current2);
          },
          rank: (input?: Dynamic): Dynamic => {
            if (
              (phone && !flag && value55.current == null
                ? value19.current && input === value182.current
                : input === value182.current ||
                  input === value186.current[0]) ||
              input === value55.current ||
              input === value56.current ||
              value184.current?.has(input)
            )
              return -1;
            let value250: Dynamic = value146.current.artboards.find(
              (input2?: Dynamic): Dynamic => input2.file === input,
            );
            return value250
              ? (0, runtime.previewMountPriority)(value250, callback37())
              : 1 / 0;
          },
        }),
        (): Dynamic => runtime.artboardBootScheduler.configure(null)
      ),
      [],
    );
    let value199: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value200: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(false),
      callback38: Dynamic = (input: Dynamic = performance.now()): Dynamic => {
        let value250: Dynamic = callback37(),
          artboards: Dynamic = value146.current.artboards,
          value251: Dynamic = value55.current != null && value188 > value187;
        value251
          ? (value199.current ??= Math.min(
              value188,
              Math.max(value187, value194.current.size + 1),
            ))
          : (value199.current = null);
        if (value55.current == null && value200.current) {
          value200.current = false;
          for (let value258 of value194.current as Dynamic)
            value195.current.set(value258, input);
        }
        let value252: Dynamic = value251
            ? artboards
                .filter(
                  (input2?: Dynamic): Dynamic =>
                    value194.current.has(input2.file),
                )
                .sort(
                  (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                    (0, runtime.previewMountPriority)(input2, value250) -
                    (0, runtime.previewMountPriority)(options2, value250),
                )
                .map((input2?: Dynamic): Dynamic => input2.file)
            : [],
          scale: Dynamic = value34.current.get().scale,
          value253: Dynamic = !value62.current && value130.current.size === 0,
          value254: Dynamic =
            !value251 &&
            value253 &&
            (0, runtime.previewScaleChanged)(value197.current, scale);
        value9.current?.clientWidth &&
          !value251 &&
          ((0, runtime.recordVisiblePreviewTimes)(
            value195.current,
            artboards,
            value250,
            value196.current,
            input,
          ),
          (value196.current = value250),
          value253 && (value197.current = scale));
        let value255: Dynamic = value186.current[0],
          value256: Dynamic =
            value255 != null
              ? artboards.find(
                  (input2?: Dynamic): Dynamic => input2.file === value255,
                )
              : undefined,
          value257: Dynamic =
            value256 != null &&
            (0, runtime.distanceBetweenRects)(value256, value250) === 0;
        return (0, runtime.chooseMountedPreviews)({
          artboards: artboards,
          viewport: value250,
          cap: value187,
          ceiling: value251 ? value199.current : value188,
          lastOnScreen: value251 ? undefined : value195.current,
          now: input,
          zoomed: value254,
          areaBudget: value35
            ? options.phoneCanvasRunsNothing === true
              ? 0
              : 15e5
            : undefined,
          required:
            value35 && value55.current == null
              ? (0, runtime.limitMountedPreviewPixels)(
                  [...(value184.current ?? [])],
                  [
                    value19.current ? value182.current : null,
                    value56.current,
                    ...(value185.current ?? []),
                  ],
                  artboards,
                  options.phoneCanvasRunsNothing === true ? 0 : 15e5,
                )
              : [
                  ...(value184.current ?? []),
                  value182.current,
                  value55.current,
                  value56.current,
                  value257 && !(phone && value55.current == null)
                    ? value255
                    : null,
                  ...(value185.current ?? []),
                  ...value252,
                ],
          recent:
            value35 && value55.current == null
              ? value186.current.slice(0, 1)
              : [
                  ...value186.current,
                  ...[
                    ...(value130.current.has("marquee")
                      ? value58.current
                      : value57.current.files),
                  ].reverse(),
                ],
          current: value194.current,
        });
      },
      value201: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        value35 && options.viewSettled === false,
      ),
      [value202, value203]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(
        (): Dynamic => (value201.current ? new Set() : callback38()),
      );
    value194.current = value202;
    let callback39: Dynamic = (): Dynamic => {
        if (value201.current) return;
        let current: Dynamic = value55.current;
        current != null && (value200.current = true);
        if (
          current != null &&
          value194.current.has(current) &&
          [...(value184.current ?? [])].every(
            (input?: Dynamic): Dynamic => value194.current.has(input),
          )
        )
          return;
        let value250: Dynamic = performance.now(),
          value251: Dynamic = callback38(value250);
        (0, runtime.samePreviewFiles)(value251, value194.current) ||
          value203(value251);
        value198.current != null && clearTimeout(value198.current);
        let value252: Dynamic =
          value188 > value187 && value55.current == null
            ? (0, runtime.nextPreviewExpiry)(
                value251,
                value146.current.artboards,
                value196.current ?? callback37(),
                value195.current,
                value250,
              )
            : null;
        value198.current =
          value252 == null
            ? null
            : setTimeout(callback41, value252 - value250 + 50);
      },
      value204: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(undefined),
      value205: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(undefined),
      value206: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value207: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(undefined);
    (0, runtime.reactVectorToolState_2.useLayoutEffect)((): Dynamic => {
      value207.current !== fullscreenFile &&
        (value35 && fullscreenFile != null && callback36(fullscreenFile),
        (value207.current = fullscreenFile));
      value205.current !== focusedFile &&
        ((!value35 || value18) &&
          value205.current != null &&
          callback36(value205.current),
        (!value35 || value18) && focusedFile != null && callback36(focusedFile),
        (value205.current = focusedFile));
      value206.current !== playingFile &&
        (value206.current != null && callback36(value206.current),
        playingFile != null && callback36(playingFile),
        (value206.current = playingFile));
      let value250: Dynamic = value130.current.has("marquee");
      if (!value250) {
        for (let value251 of selectedArtboards as Dynamic)
          (!value35 || value18) &&
            !value58.current.has(value251) &&
            callback36(value251);
        value58.current = selectedArtboards;
      }
      for (let value251 of (livePins ?? []) as Dynamic)
        value204.current?.has(value251) || callback36(value251);
      value204.current = livePins;
      options.viewSettled !== false && (value201.current = false);
      value250 ? callback41() : callback39();
      for (let value251 of (value21
        ? [value18 ? focusedFile : null, playingFile, ...(livePins ?? [])]
        : [
            focusedFile,
            fullscreenFile,
            playingFile,
            value186.current[0],
            ...(livePins ?? []),
          ]) as Dynamic)
        runtime.artboardBootScheduler.expedite(value251);
    }, [
      selectedArtboards,
      manifest.artboards,
      focusedFile,
      fullscreenFile,
      playingFile,
      livePins,
      inUseFiles,
      value86,
      value35 ? options.viewSettled : undefined,
      value35 ? value18 : undefined,
    ]);
    let value208: Dynamic = manifest.artboards.length > 0,
      value209: Dynamic = (0, runtime.useLatestCallback)((): Dynamic => {
        value201.current && ((value201.current = false), callback39());
      });
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      if (!value201.current || !value208) return;
      let value250: Dynamic = setTimeout(value209, 1e3);
      return (): Dynamic => clearTimeout(value250);
    }, [value208, value209]);
    let value210: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value211: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value212: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      callback40: Dynamic = (): Dynamic => {
        value210.current = null;
        if (
          (value62.current || value130.current.size > 0) &&
          ((value212.current ??= Date.now()),
          Date.now() - value212.current < runtime.canvasLongPressDelayMs)
        ) {
          value211.current = null;
          value210.current = setTimeout(callback40, 120);
          return;
        }
        value212.current = null;
        value211.current = null;
        callback39();
      },
      callback41: Dynamic = (): Dynamic => {
        let value250: Dynamic = Date.now();
        value210.current != null && clearTimeout(value210.current);
        value211.current ??= value250;
        let value251: Dynamic = value250 - value211.current;
        value210.current = setTimeout(
          callback40,
          Math.max(
            0,
            Math.min(
              runtime.canvasDragActivationDelayMs,
              runtime.canvasTouchDragActivationDelayMs - value251,
            ),
          ),
        );
      };
    (0, runtime.reactVectorToolState_2.useEffect)(
      (): Dynamic => (
        callback41(),
        camera.subscribe((): Dynamic => {
          callback41();
          value91.current?.();
        })
      ),
      [camera],
    );
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      let current: Dynamic = value9.current,
        value250: Dynamic =
          current && typeof ResizeObserver !== "undefined"
            ? new ResizeObserver((): Dynamic => callback41())
            : null;
      current && value250?.observe(current);
      return (): Dynamic => {
        value250?.disconnect();
        value210.current != null && clearTimeout(value210.current);
        value198.current != null && clearTimeout(value198.current);
      };
    }, []);
    let [value213, value214]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)((): Dynamic => new Set()),
      value215: Dynamic = (0, runtime.useLatestCallback)(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          value214((input2?: Dynamic): Dynamic => {
            if (input2.has(input) === options2) return input2;
            let values: Dynamic = new Set(input2);
            options2 ? values.add(input) : values.delete(input);
            return values;
          });
        },
      ),
      callback42: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        if (callback2(input)) return value156(input);
        callback36(input);
        callback39();
        runtime.artboardBootScheduler.expedite(input);
        value18 || value60(input, options2);
      },
      callback43: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => ({
        ...(0, runtime.replaceDesignArtboards)(
          manifest,
          manifest.artboards.map((input2?: Dynamic): Dynamic => {
            let entry2: Dynamic = input.get(input2.file);
            return entry2
              ? {
                  ...input2,
                  x: entry2.x,
                  y: entry2.y,
                }
              : input2;
          }),
        ),
        ...(options2.size > 0
          ? {
              annotations: (manifest.annotations ?? []).map(
                (input2?: Dynamic): Dynamic => {
                  let entry2: Dynamic = options2.get(input2.id);
                  return entry2
                    ? (0, runtime.moveAnnotation)(input2, entry2.x, entry2.y)
                    : input2;
                },
              ),
            }
          : {}),
      }),
      callback44: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.isShapeAnnotation)(input)
          ? (0, runtime.annotationBounds)(input)
          : {
              x: input.x,
              y: input.y,
              w: value12(input),
              h:
                value10[input.id]?.h ??
                (0, runtime.annotationVisibleBounds)(input).h,
            },
      value216: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        callback44,
      );
    value216.current = callback44;
    let callback45: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.canvasSnapReferenceLines)(
          manifest.artboards,
          (manifest.annotations ?? []).map(
            (input2?: Dynamic): Dynamic => ({
              id: input2.id,
              ...(0, runtime.rotatedAnnotationBounds)(
                input2,
                value216.current(input2),
              ),
            }),
          ),
          {
            files: new Set(input.files ?? []),
            notes: new Set(input.notes ?? []),
          },
          false,
        ),
      callback46: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value250?: Dynamic,
        extra?: Dynamic,
        detail: Dynamic = false,
      ): Dynamic => {
        if (input.button !== 0) return;
        let current: Dynamic = value67.current;
        current && callback47(current.pointerId);
        let value251: Dynamic = current && current.live && !current.alt,
          entries2: Dynamic = new Map(
            value251
              ? current.set.map(
                  (input2?: Dynamic): Dynamic => [input2.file, input2],
                )
              : [],
          ),
          entries3: Dynamic = new Map(
            value251
              ? current.notes.map(
                  (input2?: Dynamic): Dynamic => [input2.id, input2],
                )
              : [],
          );
        input.currentTarget.setPointerCapture(input.pointerId);
        value134("frame-drag", true);
        callback30("frame-drag");
        let value252: Dynamic = manifest.artboards
            .filter(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.hasBoardSelection)(value250, {
                  file: input2.file,
                }) ||
                ("file" in options2 && options2.file === input2.file),
            )
            .map(
              (input2?: Dynamic): Dynamic =>
                entries2.get(input2.file) ?? {
                  file: input2.file,
                  x: input2.x,
                  y: input2.y,
                  w: input2.w,
                  h: input2.h,
                },
            ),
          value253: Dynamic = (manifest.annotations ?? [])
            .filter(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.hasBoardSelection)(value250, {
                  note: input2.id,
                }) ||
                ("note" in options2 && options2.note === input2.id),
            )
            .map(
              (input2?: Dynamic): Dynamic => entries3.get(input2.id) ?? input2,
            ),
          value254: Dynamic =
            ("file" in options2
              ? entries2.get(options2.file)
              : entries3.get(options2.note)) ?? context,
          value255: Dynamic = input.altKey && onDuplicateObjects != null,
          value256: Dynamic = (0, runtime.unionRects)([
            ...value252,
            ...value253.map(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.rotatedAnnotationBounds)(
                  input2,
                  value216.current(input2),
                ),
            ),
          ]),
          value257: Dynamic = manifest.artboards.map(
            (input2?: Dynamic): Dynamic => entries2.get(input2.file) ?? input2,
          ),
          value258: Dynamic = (manifest.annotations ?? []).map(
            (input2?: Dynamic): Dynamic => {
              let value261: Dynamic = entries3.get(input2.id) ?? input2;
              return {
                id: value261.id,
                ...(0, runtime.rotatedAnnotationBounds)(
                  value261,
                  value216.current(value261),
                ),
              };
            },
          ),
          state: Dynamic = {
            files: new Set(
              value252.map((input2?: Dynamic): Dynamic => input2.file),
            ),
            notes: new Set(
              value253.map((input2?: Dynamic): Dynamic => input2.id),
            ),
          },
          value259: Dynamic = (0, runtime.canvasSnapReferenceObjects)(
            value257,
            value258,
            state,
            false,
          ),
          value260: Dynamic = (0, runtime.canvasSnapReferenceObjects)(
            value257,
            value258,
            state,
            true,
          ),
          pointerId: Dynamic = input.pointerId;
        (0, runtime.focusCanvasDocument)();
        let flag2: Dynamic = false,
          callback61: Dynamic = (event?: Dynamic): Dynamic => {
            let current2: Dynamic = value67.current;
            event.key === "Escape" && event.type === "keyup" && (flag2 = false);
            if (event.key === "Escape" && event.type === "keydown" && flag2) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }
            if (
              !(!current2 || current2.pointerId !== pointerId || !current2.live)
            ) {
              if (event.key === "Escape" && event.type === "keydown") {
                event.preventDefault();
                event.stopImmediatePropagation();
                flag2 = true;
                value218.current(pointerId);
                return;
              }
              event.key === "Alt" &&
                !event.repeat &&
                current2.last &&
                value219.current(
                  {
                    ...current2.last,
                    pointerId: pointerId,
                    altKey: event.type === "keydown",
                  },
                  false,
                );
              event.key === "Control" &&
                !event.repeat &&
                current2.last &&
                current2.hoverKey &&
                value219.current(
                  {
                    ...current2.last,
                    pointerId: pointerId,
                    altKey: current2.alt,
                    ctrlKey: event.type === "keydown",
                  },
                  false,
                );
            }
          },
          callback62: Dynamic = (): Dynamic => value218.current(pointerId);
        (window as Dynamic).addEventListener("keydown", callback61, true);
        (window as Dynamic).addEventListener("keyup", callback61, true);
        (window as Dynamic).addEventListener("blur", callback62);
        value67.current = {
          ref: options2,
          set: value252,
          notes: value253,
          pointerId: pointerId,
          startX: input.clientX,
          startY: input.clientY,
          origX: value254.x,
          origY: value254.y,
          alt: value255,
          last: null,
          unlisten: (): Dynamic => {
            (window as Dynamic).removeEventListener("blur", callback62);
            if (!flag2) {
              (window as Dynamic).removeEventListener(
                "keydown",
                callback61,
                true,
              );
              (window as Dynamic).removeEventListener(
                "keyup",
                callback61,
                true,
              );
              return;
            }
            let callback63: Dynamic = (input2?: Dynamic): Dynamic => {
              input2.key !== "Escape" ||
                input2.type !== "keyup" ||
                ((window as Dynamic).removeEventListener(
                  "keydown",
                  callback61,
                  true,
                ),
                (window as Dynamic).removeEventListener(
                  "keyup",
                  callback61,
                  true,
                ),
                (window as Dynamic).removeEventListener(
                  "keyup",
                  callback63,
                  true,
                ));
            };
            (window as Dynamic).addEventListener("keyup", callback63, true);
          },
          click: extra,
          focus: detail && !input.altKey,
          live: false,
          snap: value256
            ? {
                box: value256,
                moveLines: (0, runtime.rectangleSnapGuides)(value259),
                copyLines: (0, runtime.rectangleSnapGuides)(value260),
                moveStill: value259,
                copyStill: value260,
              }
            : null,
        };
      },
      callback47: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value67.current;
        !current ||
          input !== current.pointerId ||
          ((value67.current = null),
          current.unlisten(),
          (value68.current = null),
          value134("frame-drag", false),
          value70(null),
          value72(null),
          current.alt
            ? value74(null)
            : current.live && callback48(current.set, current.notes),
          current.hoverKey &&
            value217.current?.({
              key: current.hoverKey,
              target: null,
              point: {
                x: 0,
                y: 0,
              },
              object: current.set[0]
                ? {
                    file: current.set[0].file,
                  }
                : {
                    note: current.notes[0].id,
                  },
              at: {
                x: 0,
                y: 0,
                w: 0,
                h: 0,
              },
              ctrl: false,
            }));
      },
      value217: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        onObjectHover,
      );
    value217.current = onObjectHover;
    let callback48: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let entries2: Dynamic = new Map(
            input.map((input2?: Dynamic): Dynamic => [input2.file, input2]),
          ),
          entries3: Dynamic = new Map(
            options2.map((input2?: Dynamic): Dynamic => [input2.id, input2]),
          );
        onManifestChange(callback43(entries2, entries3), false);
      },
      value218: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        callback47,
      );
    value218.current = callback47;
    let callback49: Dynamic = (input?: Dynamic): Dynamic =>
      callback47(input.pointerId);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      !value18 &&
        value67.current &&
        value218.current(value67.current.pointerId);
    }, [value18]);
    let callback50: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => {
        let current: Dynamic = value67.current;
        if (
          !current ||
          input.pointerId !== current.pointerId ||
          (current.setMove && input.fromSetMove !== true)
        )
          return;
        options2 &&
          ((value67.current = null),
          current.unlisten(),
          value134("frame-drag", false));
        if (!current.live) {
          if (
            Math.hypot(
              input.clientX - current.startX,
              input.clientY - current.startY,
            ) <
            (input.pointerType === "touch"
              ? 10
              : runtime.canvasDragThresholdPixels)
          ) {
            options2 &&
              (current.click &&
                onSelectObjects(
                  (0, runtime.boardSelectionItems)(current.ref),
                  current.click === "toggle" ? "toggle" : "replace",
                ),
              current.focus &&
                "file" in current.ref &&
                onFocus(current.ref.file));
            return;
          }
          if (!value18) return;
          current.live = true;
        }
        current.last = {
          clientX: input.clientX,
          clientY: input.clientY,
          metaKey: input.metaKey,
          ctrlKey: input.ctrlKey,
          pointerType: input.pointerType,
        };
        let value250: Dynamic = input.altKey && onDuplicateObjects != null;
        value250 !== current.alt &&
          (value250 ? callback48(current.set, current.notes) : value74(null),
          (current.alt = value250));
        let { scale: entry2 }: Dynamic = camera.get(),
          {
            dx: value251,
            dy: value252,
            guides: value253,
            gaps: value254,
          }: Dynamic = (0, runtime.snapCanvasDrag)(
            (input.clientX - current.startX) / entry2,
            (input.clientY - current.startY) / entry2,
            current.snap
              ? {
                  box: current.snap.box,
                  lines: value250
                    ? current.snap.copyLines
                    : current.snap.moveLines,
                  boxes: value250
                    ? current.snap.copyStill
                    : current.snap.moveStill,
                }
              : null,
            runtime.canvasTouchDragThresholdPixels / entry2,
            input.metaKey || input.ctrlKey,
          );
        value70(options2 || value253.length === 0 ? null : value253);
        value72(options2 || value254.length === 0 ? null : value254);
        let callback61: Dynamic = (input2?: Dynamic): Dynamic => ({
            x: Math.round(input2.x + value251),
            y: Math.round(input2.y + value252),
          }),
          value255: Dynamic = callback61({
            x: current.origX,
            y: current.origY,
          }),
          value256: Dynamic = !(
            value255.x === Math.round(current.origX) &&
            value255.y === Math.round(current.origY)
          );
        if (current.alt) {
          current.hoverKey &&
            onObjectHover?.({
              key: current.hoverKey,
              target: null,
              point: {
                x: 0,
                y: 0,
              },
              object: current.set[0]
                ? {
                    file: current.set[0].file,
                  }
                : {
                    note: current.notes[0].id,
                  },
              at: {
                x: 0,
                y: 0,
                w: 0,
                h: 0,
              },
              ctrl: false,
            });
          if (!options2) {
            value74([
              ...current.set.map(
                (input2?: Dynamic): Dynamic => ({
                  ...callback61(input2),
                  w: input2.w,
                  h: input2.h,
                }),
              ),
              ...current.notes.map((input2?: Dynamic): Dynamic => {
                let value257: Dynamic = (0, runtime.rotatedAnnotationBounds)(
                  input2,
                  callback44(input2),
                );
                return {
                  ...value257,
                  ...callback61(value257),
                };
              }),
            ]);
            return;
          }
          value74(null);
          value256
            ? onDuplicateObjects?.(
                current.set.map(
                  (input2?: Dynamic): Dynamic => ({
                    file: input2.file,
                    ...callback61(input2),
                  }),
                ),
                current.notes.map(
                  (input2?: Dynamic): Dynamic => ({
                    id: input2.id,
                    ...callback61(input2),
                  }),
                ),
                current.bound,
                current.setMove != null,
              )
            : current.setMove != null &&
              current.bound !== undefined &&
              onDuplicateObjects?.([], [], current.bound, true);
          return;
        }
        if (options2 && !value256) {
          callback48(current.set, current.notes);
          current.hoverKey &&
            onObjectHover?.({
              key: current.hoverKey,
              target: null,
              point: {
                x: 0,
                y: 0,
              },
              object: current.set[0]
                ? {
                    file: current.set[0].file,
                  }
                : {
                    note: current.notes[0].id,
                  },
              at: {
                x: 0,
                y: 0,
                w: 0,
                h: 0,
              },
              ctrl: false,
            });
          return;
        }
        if (
          !current.alt &&
          !current.setMove &&
          (onDropObjectInto || onObjectHover) &&
          current.set.length + current.notes.length === 1
        ) {
          let value257: Dynamic = current.set[0]
              ? {
                  file: current.set[0].file,
                }
              : {
                  note: current.notes[0].id,
                },
            value258: Dynamic =
              "note" in value257 ||
              manifest.artboards.find(
                (input2?: Dynamic): Dynamic => input2.file === value257.file,
              )?.frameless === true,
            value259: Dynamic = value9.current?.getBoundingClientRect(),
            value260: Dynamic =
              value258 && value259
                ? callback16(input.clientX, input.clientY, value259)
                : null;
          if (value260) {
            let callback62: Dynamic = (
              input2?: Dynamic,
              options3?: Dynamic,
            ): Dynamic =>
              options3.x >= input2.x &&
              options3.x <= input2.x + input2.w &&
              options3.y >= input2.y &&
              options3.y <= input2.y + input2.h;
            current.left ??= new Set();
            for (let value264 of manifest.artboards as Dynamic)
              !value264.frameless &&
                !callback62(value264, value260) &&
                current.left.add(value264.file);
            let value261: Dynamic =
                [...manifest.artboards]
                  .reverse()
                  .find(
                    (input2?: Dynamic): Dynamic =>
                      !input2.frameless &&
                      input2.file !==
                        ("file" in value257 ? value257.file : "") &&
                      callback62(input2, value260),
                  ) ?? null,
              value262: Dynamic =
                value261 && current.left.has(value261.file) ? value261 : null,
              value263: Dynamic = current.set[0]
                ? {
                    ...callback61(current.set[0]),
                    w: current.set[0].w,
                    h: current.set[0].h,
                  }
                : ((): Dynamic => {
                    let value264: Dynamic = current.notes[0],
                      value265: Dynamic = callback44(value264);
                    return {
                      ...callback61(value265),
                      w: value265.w,
                      h: value265.h,
                    };
                  })();
            current.hoverKey ??= "obj-" + String(++canvasDragSequence);
            if (!options2)
              onObjectHover?.({
                key: current.hoverKey,
                target: value262?.file ?? null,
                point: value260,
                object: value257,
                at: value263,
                ctrl: input.ctrlKey,
              });
            else if (value262 && onDropObjectInto) {
              callback48(current.set, current.notes);
              if (
                onDropObjectInto({
                  key: current.hoverKey,
                  target: value262.file,
                  point: value260,
                  object: value257,
                  at: value263,
                  ctrl: input.ctrlKey,
                })
              )
                return;
              onObjectHover?.({
                key: current.hoverKey,
                target: null,
                point: value260,
                object: value257,
                at: value263,
                ctrl: input.ctrlKey,
              });
            } else
              onObjectHover?.({
                key: current.hoverKey,
                target: null,
                point: value260,
                object: value257,
                at: value263,
                ctrl: input.ctrlKey,
              });
          }
        }
        let entries2: Dynamic = new Map(
            current.set.map(
              (input2?: Dynamic): Dynamic => [
                input2.file,
                (0, runtime.preserveUnroundedDragPosition)(
                  input2,
                  callback61(input2),
                ),
              ],
            ),
          ),
          entries3: Dynamic = new Map(
            current.notes.map(
              (input2?: Dynamic): Dynamic => [
                input2.id,
                (0, runtime.preserveUnroundedDragPosition)(
                  input2,
                  callback61(input2),
                ),
              ],
            ),
          );
        onManifestChange(
          callback43(entries2, entries3),
          options2,
          options2
            ? {
                moved: new Map(
                  current.set.map(
                    (input2?: Dynamic): Dynamic => [
                      input2.file,
                      {
                        x: input2.x,
                        y: input2.y,
                      },
                    ],
                  ),
                ),
                movedNotes: new Map(
                  current.notes.map(
                    (input2?: Dynamic): Dynamic => [input2.id, input2],
                  ),
                ),
                ...(current.bound !== undefined
                  ? {
                      bound: current.bound,
                    }
                  : {}),
              }
            : undefined,
        );
      },
      value219: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        callback50,
      );
    value219.current = callback50;
    let callback51: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value250?: Dynamic,
        extra?: Dynamic,
        detail?: Dynamic,
      ): Dynamic => {
        let current: Dynamic = value67.current;
        current && value218.current(current.pointerId);
        let current2: Dynamic = value146.current,
          value251: Dynamic = current2.artboards
            .filter(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.hasBoardSelection)(value250, {
                  file: input2.file,
                }),
            )
            .map(
              (input2?: Dynamic): Dynamic => ({
                file: input2.file,
                x: input2.x,
                y: input2.y,
                w: input2.w,
                h: input2.h,
              }),
            ),
          value252: Dynamic = (current2.annotations ?? []).filter(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.hasBoardSelection)(value250, {
                note: input2.id,
              }),
          ),
          value253: Dynamic = ("file" in context
            ? value251.find(
                (input2?: Dynamic): Dynamic => input2.file === context.file,
              )
            : value252.find(
                (input2?: Dynamic): Dynamic => input2.id === context.note,
              )) ??
            value251[0] ??
            value252[0] ?? {
              x: 0,
              y: 0,
            };
        value67.current = {
          ref: context,
          set: value251,
          notes: value252,
          pointerId: options2,
          startX: extra,
          startY: detail,
          origX: value253.x,
          origY: value253.y,
          alt: false,
          last: null,
          unlisten: (): Dynamic => {},
          click: null,
          focus: false,
          live: true,
          setMove: input,
          snap: null,
        };
      },
      callback52: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value250?: Dynamic,
        extra?: Dynamic,
        detail?: Dynamic,
        argument?: Dynamic,
        argument2: Dynamic = false,
      ): Dynamic => {
        let current: Dynamic = value67.current;
        return !current ||
          current.pointerId !== options2 ||
          current.setMove !== input
          ? false
          : (argument !== undefined && (current.bound = argument),
            value219.current(
              {
                pointerId: options2,
                clientX: context,
                clientY: value250,
                altKey: argument2,
                metaKey: extra,
                ctrlKey: false,
                pointerType: "mouse",
                fromSetMove: true,
              },
              detail,
            ),
            true);
      },
      value220: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        onSetMoveCommit,
      );
    value220.current = onSetMoveCommit;
    let [value221, value222]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value223: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        onSetMoveSay,
      );
    value223.current = onSetMoveSay;
    let [value224, value225]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      value226: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(null),
      value227: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(
        setMovePieces,
      );
    value227.current = setMovePieces;
    value226.current ??= (0, runtime.createElementMoveSessions)({
      handle: (input?: Dynamic): Dynamic => value2.current.get(input),
      targetAt: (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value250: Dynamic = value9.current?.getBoundingClientRect();
        if (!value250 || value55.current != null) return null;
        let value251: Dynamic = callback16(input, options2, value250),
          files: Dynamic = value57.current.files,
          artboards: Dynamic = value146.current.artboards;
        for (
          let value252: Dynamic = artboards.length - 1;
          value252 >= 0;
          value252--
        ) {
          let value253: Dynamic = artboards[value252];
          if (
            value251.x < value253.x ||
            value251.y < value253.y ||
            value251.x > value253.x + value253.w ||
            value251.y > value253.y + value253.h
          )
            continue;
          if (files.has(value253.file)) return null;
          if (value253.frameless && value183.current !== value253.file)
            continue;
          let state: Dynamic = {
            x: value251.x - value253.x,
            y: value251.y - value253.y,
          };
          return value253.file === value56.current
            ? {
                file: value253.file,
                local: state,
                blocked: "playing",
              }
            : {
                file: value253.file,
                local: state,
              };
        }
        return null;
      },
      showGhost: (input?: Dynamic): Dynamic =>
        value225(
          (input2?: Dynamic): Dynamic =>
            input2 === null && input === null ? input2 : input,
        ),
      say: (input?: Dynamic): Dynamic => value223.current?.(input),
      origin: (input?: Dynamic): Dynamic => {
        let value250: Dynamic = value146.current.artboards.find(
          (input2?: Dynamic): Dynamic => input2.file === input,
        );
        return value250
          ? {
              x: value250.x,
              y: value250.y,
            }
          : undefined;
      },
      canvasPoint: (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value250: Dynamic = value9.current?.getBoundingClientRect();
        return value250
          ? callback16(input, options2, value250)
          : {
              x: input,
              y: options2,
            };
      },
      slopPx: runtime.canvasDragThresholdPixels,
      canvas: {
        start: callback51,
        update: callback52,
        cancel: (input?: Dynamic, options2?: Dynamic): Dynamic => {
          value67.current?.setMove === input && value218.current(options2);
        },
      },
      setGestureSource: (input?: Dynamic, options2?: Dynamic): Dynamic =>
        value134(input, options2),
      claimKeyboard: runtime.focusCanvasDocument,
      setHeldCover: value222,
      commit: (input?: Dynamic): Dynamic =>
        value220.current?.(input) ?? Promise.resolve(),
      readOnly: (): Dynamic => !value19.current,
      piecesAllowed: (): Dynamic => value227.current === true,
      bounds: (input?: Dynamic): Dynamic => {
        let value250: Dynamic = value146.current.artboards.find(
          (input2?: Dynamic): Dynamic => input2.file === input,
        );
        return value250
          ? {
              x: value250.x,
              y: value250.y,
              w: value250.w,
              h: value250.h,
            }
          : undefined;
      },
    });
    let value228: Dynamic =
        onSetMoveCommit != null &&
        (0, runtime.hasMultipleEditingGroups)(
          selectedTidsByFile,
          selectedArtboards.size + selectedNotes.size,
        ),
      value229: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(value228);
    value229.current = value228;
    let callback53: Dynamic = (input?: Dynamic): Dynamic => {
        let value250: Dynamic =
            input.files ??
            new Map(
              Object.entries(value26.current ?? {}).filter(
                ([, items]: Dynamic): Dynamic => items.length > 0,
              ),
            ),
          value251: Dynamic = input.canvas ?? {
            files: value57.current.files,
            notes: value57.current.notes,
          };
        return (
          value226.current?.begin({
            ...input,
            files: value250,
            canvas: value251,
          }) ?? false
        );
      },
      callback54: Dynamic = (): Dynamic =>
        Object.values(value26.current ?? {}).some(
          (items?: Dynamic): Dynamic => items.length > 0,
        ),
      callback55: Dynamic = (input?: Dynamic): Dynamic => ({
        onPointerDown: (event?: Dynamic): Dynamic => {
          if (event.button !== 0) return;
          let shiftKey: Dynamic = event.shiftKey;
          if (
            (0, runtime.isTouchSelectionStart)(
              event.pointerType,
              value57.current.notes.has(input.id),
            )
          ) {
            (0, runtime.watchPointerRelease)(
              event.nativeEvent,
              (): Dynamic =>
                onSelectObjects(
                  (0, runtime.boardSelectionItems)({
                    note: input.id,
                  }),
                  shiftKey ? "toggle" : "replace",
                ),
            );
            return;
          }
          event.stopPropagation();
          if (
            onSetMoveCommit &&
            event.pointerType !== "touch" &&
            !shiftKey &&
            !event.altKey &&
            (0, runtime.hasBoardSelection)(value57.current, {
              note: input.id,
            }) &&
            callback54()
          ) {
            callback53({
              pointerId: event.pointerId,
              captureEl: event.currentTarget,
              clientX: event.clientX,
              clientY: event.clientY,
              leader: {
                canvas: {
                  note: input.id,
                },
              },
              stillAction: (): Dynamic =>
                onSelectObjects(
                  (0, runtime.boardSelectionItems)({
                    note: input.id,
                  }),
                  "replace",
                ),
              armWait: null,
              heldCover: null,
            });
            return;
          }
          let value250: Dynamic = (0, runtime.selectionPointerDownDecision)(
            value57.current,
            {
              note: input.id,
            },
            shiftKey,
          );
          value250.selectNow &&
            onSelectObjects(
              (0, runtime.boardSelectionItems)({
                note: input.id,
              }),
              shiftKey ? "toggle" : "replace",
            );
          callback46(
            event,
            {
              note: input.id,
            },
            input,
            value250.carry,
            value250.click,
          );
        },
        onPointerMove: (input2?: Dynamic): Dynamic => callback50(input2, false),
        onPointerUp: (input2?: Dynamic): Dynamic => callback50(input2, true),
        onPointerCancel: callback49,
      }),
      callback56: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value57.current;
        (current.notes.size === 1 &&
          current.notes.has(input) &&
          current.files.size === 0) ||
          onSelectObjects(
            (0, runtime.boardSelectionItems)({
              note: input,
            }),
            "replace",
          );
        actionsRef.current?.setTool("vector");
      },
      callback57: Dynamic = (
        event?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        if (event.button !== 0 || !value18 || value130.current.has("resize"))
          return;
        event.preventDefault();
        event.stopPropagation();
        (0, runtime.focusCanvasDocument)();
        let pointerId: Dynamic = event.pointerId,
          ancestor: Dynamic = event.currentTarget.closest(
            '[data-mega-chrome="' + options2 + '"]',
          ),
          callback61: Dynamic = (input?: Dynamic): Dynamic => {
            try {
              input?.setPointerCapture(pointerId);
            } catch {}
          };
        callback61(event.currentTarget);
        value134("resize", true);
        callback30("resize");
        let [items, items2]: Dynamic = [event.clientX, event.clientY],
          callback62: Dynamic = (): Dynamic =>
            !!ancestor?.isConnected && value19.current,
          flag2: Dynamic = false,
          callback63: Dynamic = (input?: Dynamic): Dynamic => {
            if (input.pointerId === pointerId) {
              if (!callback62()) return callback67();
              (!flag2 &&
                Math.hypot(input.clientX - items, input.clientY - items2) <
                  4) ||
                ((flag2 = true), context.live(input));
            }
          },
          callback64: Dynamic = (input?: Dynamic): Dynamic => {
            input.pointerId === pointerId && callback61(ancestor);
          },
          callback65: Dynamic = (): Dynamic => {
            (window as Dynamic).removeEventListener("pointermove", callback63);
            (window as Dynamic).removeEventListener("pointerup", callback66);
            (window as Dynamic).removeEventListener(
              "pointercancel",
              callback67,
            );
            (window as Dynamic).removeEventListener(
              "keydown",
              callback68,
              true,
            );
            (document as Dynamic).removeEventListener(
              "lostpointercapture",
              callback64,
              true,
            );
            value134("resize", false);
            context.end?.();
          },
          callback66: Dynamic = (input?: Dynamic): Dynamic => {
            input.pointerId === pointerId &&
              (callback65(),
              flag2 &&
                (callback62() ? context.commit(input) : context.revert()));
          },
          callback67: Dynamic = (input?: Dynamic): Dynamic => {
            (input && input.pointerId !== pointerId) ||
              (callback65(), flag2 && context.revert());
          },
          callback68: Dynamic = (event2?: Dynamic): Dynamic => {
            event2.key === "Escape" &&
              (event2.preventDefault(),
              event2.stopImmediatePropagation(),
              callback67());
          };
        (window as Dynamic).addEventListener("pointermove", callback63);
        (window as Dynamic).addEventListener("pointerup", callback66);
        (window as Dynamic).addEventListener("pointercancel", callback67);
        (window as Dynamic).addEventListener("keydown", callback68, true);
        (document as Dynamic).addEventListener(
          "lostpointercapture",
          callback64,
          true,
        );
      },
      value230: Dynamic = manifest.artboards.filter(
        (input?: Dynamic): Dynamic => selectedArtboards.has(input.file),
      ),
      value231: Dynamic = (manifest.annotations ?? [])
        .filter((input?: Dynamic): Dynamic => selectedNotes.has(input.id))
        .map((input?: Dynamic): Dynamic => {
          let value250: Dynamic = callback44(input);
          return {
            spec: input,
            box: value250,
            bounds: (0, runtime.rotatedAnnotationBounds)(input, value250),
          };
        }),
      value232: Dynamic = value230.length + value231.length > 1,
      [value233, value234]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)(null),
      [value235, value236]: Dynamic = (0,
      runtime.reactVectorToolState_2.useState)([]),
      value237: Dynamic = ((): Dynamic => {
        if (!value232 || value235.length === 0) return null;
        let value250: Dynamic = (0, runtime.selectionTransformMembers)(
          value230,
          value231.map((input?: Dynamic): Dynamic => input.spec),
        );
        for (let value251 of value235 as Dynamic) {
          let value252: Dynamic = (0, runtime.translatedSelectionTransform)(
            value251,
            value250,
          );
          if (value252) return value252;
        }
        return null;
      })(),
      value238: Dynamic =
        [...selectedArtboards].join(`
`) +
        "	" +
        [...selectedNotes].join(`
`),
      value239: Dynamic = (0, runtime.reactVectorToolState_2.useRef)(value238);
    (0, runtime.reactVectorToolState_2.useEffect)((): Dynamic => {
      value239.current !== value238 &&
        ((value239.current = value238),
        value236(
          (items?: Dynamic): Dynamic => (items.length > 0 ? [] : items),
        ));
    }, [value238]);
    let value240: Dynamic = value228
        ? (0, runtime.unionRects)([
            ...value230,
            ...value231.map((input?: Dynamic): Dynamic => input.bounds),
            ...manifest.artboards.flatMap((input?: Dynamic): Dynamic => {
              let value250: Dynamic = selectedRectsByFile?.[input.file];
              if (
                !value250 ||
                (selectedTidsByFile?.[input.file]?.length ?? 0) === 0
              )
                return [];
              let callback61: Dynamic = (input2?: Dynamic): Dynamic =>
                  Math.max(
                    -runtime.selectionChromeCoordinateOverscan,
                    Math.min(
                      input.w + runtime.selectionChromeCoordinateOverscan,
                      input2,
                    ),
                  ),
                callback62: Dynamic = (input2?: Dynamic): Dynamic =>
                  Math.max(
                    -runtime.selectionChromeCoordinateOverscan,
                    Math.min(
                      input.h + runtime.selectionChromeCoordinateOverscan,
                      input2,
                    ),
                  ),
                [items, items2, items3, items4]: Dynamic = [
                  callback61(value250.x),
                  callback62(value250.y),
                  callback61(value250.x + value250.w),
                  callback62(value250.y + value250.h),
                ];
              return items3 > items && items4 > items2
                ? [
                    {
                      x: input.x + items,
                      y: input.y + items2,
                      w: items3 - items,
                      h: items4 - items2,
                    },
                  ]
                : [];
            }),
          ])
        : null,
      value241: Dynamic =
        value240 ??
        (value232
          ? (value233?.box ??
            value237?.box ??
            (0, runtime.unionRects)([
              ...value230,
              ...value231.map((input?: Dynamic): Dynamic => input.bounds),
            ]))
          : null),
      value242: Dynamic = value233 ? value233.deg : (value237?.deg ?? 0),
      value243: Dynamic =
        value232 &&
        (!!value233?.deg ||
          value237 !== null ||
          value231.some(
            (input?: Dynamic): Dynamic =>
              input.spec.kind === "image" ||
              ((0, runtime.isShapeAnnotation)(input.spec) &&
                (0, runtime.annotationRotation)(input.spec) !== 0),
          )),
      value244: Dynamic = value232 && value230.length === 0,
      value245: Dynamic =
        value232 && value231.length > 0 && value230.length > 0
          ? "This selection can't be rotated because it includes an artboard."
          : undefined,
      value246: Dynamic =
        !value18 ||
        (0, runtime.supportsClickPlacement)(armedTool) ||
        armedTool === "draw" ||
        value240 != null,
      callback58: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value250?: Dynamic,
        extra: Dynamic = false,
      ): Dynamic => {
        let entries2: Dynamic = new Map(
            value230.map((input2?: Dynamic): Dynamic => [input2.file, input2]),
          ),
          entries3: Dynamic = new Map(
            value231.map(
              (input2?: Dynamic): Dynamic => [input2.spec.id, input2],
            ),
          ),
          callback61: Dynamic = (input2?: Dynamic): Dynamic =>
            Object.fromEntries(
              Object.entries(input2).filter(
                ([input3]: Dynamic): Dynamic => context.has(input3),
              ),
            ),
          value251: Dynamic = value241,
          callback62: Dynamic = (
            input2?: Dynamic,
            options3?: Dynamic,
          ): Dynamic => {
            value234(
              input2 && !options3
                ? {
                    box: input2.box,
                    deg: input2.deg,
                    turning: options2 === "Rotate",
                  }
                : null,
            );
            let current: Dynamic = value146.current,
              state: Dynamic = {
                ...current,
                artboards: current.artboards.map(
                  (input3?: Dynamic): Dynamic => {
                    let entry2: Dynamic = entries2.get(input3.file);
                    return entry2
                      ? {
                          ...input3,
                          ...(input2
                            ? input2.board(entry2)
                            : callback61(
                                (0, runtime.artboardTransformSnapshot)(entry2),
                              )),
                        }
                      : input3;
                  },
                ),
                ...(entries3.size > 0
                  ? {
                      annotations: (current.annotations ?? []).map(
                        (input3?: Dynamic): Dynamic => {
                          let entry2: Dynamic = entries3.get(input3.id);
                          return entry2
                            ? {
                                ...input3,
                                ...(input2
                                  ? input2.ann(entry2)
                                  : callback61(
                                      (0, runtime.annotationTransformSnapshot)(
                                        entry2.spec,
                                      ),
                                    )),
                              }
                            : input3;
                        },
                      ),
                    }
                  : {}),
              };
            options3 &&
              input2 &&
              (input2.deg !== 0 || extra) &&
              value236(
                (input3?: Dynamic): Dynamic =>
                  [
                    {
                      box: input2.box,
                      deg: input2.deg,
                      members: (0, runtime.selectionTransformMembers)(
                        state.artboards.filter(
                          (input4?: Dynamic): Dynamic =>
                            entries2.has(input4.file),
                        ),
                        (state.annotations ?? []).filter(
                          (input4?: Dynamic): Dynamic =>
                            entries3.has(input4.id),
                        ),
                      ),
                    },
                    ...input3,
                  ].slice(0, 8),
              );
            onManifestChange(
              state,
              options3,
              options3
                ? {
                    transformed: {
                      label: options2,
                      keys: context,
                      boards: entries2,
                      notes: new Map(
                        value231.map(
                          (input3?: Dynamic): Dynamic => [
                            input3.spec.id,
                            input3.spec,
                          ],
                        ),
                      ),
                    },
                  }
                : undefined,
            );
          },
          value252: Dynamic = null;
        callback57(input, "group-resize", {
          live: (input2?: Dynamic): Dynamic => {
            value252 = value250(input2);
            callback62(value252, false);
            value252 ||
              value234({
                box: value251,
                deg: value242,
                turning: options2 === "Rotate",
              });
          },
          commit: (): Dynamic => {
            value252 ? callback62(value252, true) : callback62(null, false);
          },
          revert: (): Dynamic => callback62(null, false),
          end: (): Dynamic => {
            value234(null);
            value70(null);
          },
        });
      },
      callback59: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        if (!value241) return;
        let [items, items2]: Dynamic = [value241, value242],
          { min: value250, max: value251 }: Dynamic = (0,
          runtime.selectionScaleLimits)(items, value230, value231),
          state: Dynamic = {
            x: input.x !== null,
            y: input.y !== null,
          },
          value252: Dynamic = state.x && state.y && items.w > 0 && items.h > 0,
          [items3, items4]: Dynamic = [options2.clientX, options2.clientY],
          value253: Dynamic = (0, runtime.transformTouchedProperties)(
            items2
              ? {
                  x: true,
                  y: true,
                }
              : state,
          ),
          value254: Dynamic = items2
            ? []
            : callback45({
                files: selectedArtboards,
                notes: selectedNotes,
              });
        callback58(
          options2,
          "Resize",
          value253,
          (input2?: Dynamic): Dynamic => {
            let scale: Dynamic = camera.get().scale,
              state2: Dynamic = {
                dx: (input2.clientX - items3) / scale,
                dy: (input2.clientY - items4) / scale,
              },
              value255: Dynamic =
                items2 || input2.metaKey || input2.ctrlKey
                  ? {
                      ...state2,
                      guides: [],
                    }
                  : (0, runtime.snapResize)(
                      items,
                      input,
                      state2.dx,
                      state2.dy,
                      value254,
                      runtime.canvasTouchDragThresholdPixels / scale,
                    ),
              [items5, items6]: Dynamic = [value255.dx, value255.dy];
            if (items2) {
              let value258: Dynamic = (0, runtime.resizeRotatedRect)(
                items,
                items2,
                input,
                items5,
                items6,
                value250,
                value251,
                true,
              );
              if (value258.w === items.w && value258.h === items.h) return null;
              let value259: Dynamic = (0,
              runtime.selectionUniformScaleTransform)(
                {
                  x: items.x + items.w / 2,
                  y: items.y + items.h / 2,
                },
                {
                  x: value258.x + value258.w / 2,
                  y: value258.y + value258.h / 2,
                },
                value258.w / items.w,
              );
              return {
                box: value258,
                deg: items2,
                keys: value253,
                board: (input3?: Dynamic): Dynamic =>
                  (0, runtime.transformArtboardBounds)(
                    input3,
                    value259.from,
                    value259.to,
                    runtime.bothTransformAxes,
                  ),
                ann: (input3?: Dynamic): Dynamic =>
                  (0, runtime.transformAnnotationBounds)(
                    input3.spec,
                    value259.from,
                    value259.to,
                    runtime.bothTransformAxes,
                  ),
              };
            }
            let value256: Dynamic =
                value252 && (value243 || input2.shiftKey)
                  ? (0, runtime.resizeRectKeepingAspect)(
                      items,
                      input,
                      items5,
                      items6,
                      value250,
                      value251,
                    )
                  : (0, runtime.resizeRect)(
                      items,
                      input,
                      items5,
                      items6,
                      value250,
                      value251,
                    ),
              value257: Dynamic = (0, runtime.activeResizeGuides)(
                value256,
                input,
                value255.guides,
              );
            value70(value257.length > 0 ? value257 : null);
            return value256.x === items.x &&
              value256.y === items.y &&
              value256.w === items.w &&
              value256.h === items.h
              ? null
              : {
                  box: value256,
                  deg: 0,
                  keys: value253,
                  board: (input3?: Dynamic): Dynamic =>
                    (0, runtime.transformArtboardBounds)(
                      input3,
                      items,
                      value256,
                      state,
                    ),
                  ann: (input3?: Dynamic): Dynamic =>
                    (0, runtime.transformAnnotationBounds)(
                      input3.spec,
                      items,
                      value256,
                      state,
                    ),
                };
          },
          items2 !== 0,
        );
      },
      callback60: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        if (!value241) return;
        let value250: Dynamic = value241,
          state: Dynamic = {
            x: value250.x + value250.w / 2,
            y: value250.y + value250.h / 2,
          },
          bounds: Dynamic = (
            options2.currentTarget.closest(
              '[data-mega-chrome="group-resize"]',
            ) ?? options2.currentTarget
          ).getBoundingClientRect(),
          [items, items2]: Dynamic = [
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
          ],
          value251: Dynamic = (0, runtime.angleBetweenPoints)(
            items,
            items2,
            options2.clientX,
            options2.clientY,
          ),
          value252: Dynamic = value242,
          value253: Dynamic = (0, runtime.transformTouchedProperties)("rotate");
        callback58(
          options2,
          "Rotate",
          value253,
          (input2?: Dynamic): Dynamic => {
            let value254: Dynamic = (0, runtime.snapRotation)(
              value252 +
                (0, runtime.angleBetweenPoints)(
                  items,
                  items2,
                  input2.clientX,
                  input2.clientY,
                ) -
                value251,
              input2.shiftKey,
            );
            return value254 === value252
              ? null
              : {
                  box: value250,
                  deg: value254,
                  keys: value253,
                  board: (): Dynamic => ({}),
                  ann: (input3?: Dynamic): Dynamic =>
                    (0, runtime.rotateAnnotationAboutPoint)(
                      input3.spec,
                      input3.box,
                      state,
                      value254 - value252,
                    ),
                };
          },
        );
      },
      value247: Dynamic = value80?.tool === "arrow" || value80?.tool === "line",
      value248: Dynamic = ((): Dynamic => {
        if (!value80 || !value247) return null;
        let value250: Dynamic = value80.dirX === 1 ? 0 : value80.w,
          value251: Dynamic = value80.dirY === 1 ? 0 : value80.h,
          value252: Dynamic = value80.dirX === 1 ? value80.w : 0,
          value253: Dynamic = value80.dirY === 1 ? value80.h : 0,
          value254: Dynamic =
            value80.tool === "arrow"
              ? (0, runtime.shortenLineEnd)(
                  value250,
                  value251,
                  value252,
                  value253,
                  (runtime.SvgArrowsConstant_3 * runtime.SvgDrawingConstant) /
                    entry.scale,
                )
              : {
                  x: value252,
                  y: value253,
                };
        return {
          x1: value250,
          y1: value251,
          x2: value254.x,
          y2: value254.y,
        };
      })(),
      value249: Dynamic = ((): Dynamic => {
        let value250: Dynamic = dragGhost?.box;
        if (!dragGhost || !value250) return null;
        let value251: Dynamic =
            (value9.current?.clientWidth || 1200) / entry.scale,
          value252: Dynamic =
            (value9.current?.clientHeight || 800) / entry.scale,
          value253: Dynamic = Math.min(
            1,
            (0.4 * value251) / value250.w,
            (0.4 * value252) / value250.h,
          ),
          value254: Dynamic = entry.scale * value253;
        return {
          box: value250,
          s: value254,
          left: (dragGhost.x - entry.x) * entry.scale - value250.gx * value254,
          top: (dragGhost.y - entry.y) * entry.scale - value250.gy * value254,
          width: value250.w * value254,
          height: value250.h * value254,
        };
      })();
    return (
      <runtime.ViewportContext.Provider value={camera}>
        <div
          ref={value9}
          data-testid={"mega-canvas"}
          data-hover-file={value98 ?? undefined}
          onPointerDownCapture={(event?: Dynamic): Dynamic => {
            value28(event.pointerType === "touch");
            !(
              onCanvasMenu == null ||
              !runtime.InspectorColorPickResolvedValue_2 ||
              event.button !== 0 ||
              !event.ctrlKey ||
              !callback20(event) ||
              value55.current != null ||
              value128.current ||
              (0, runtime.OutlineDcOutlineHandler)(event.target) ||
              (0, runtime.canvasContextMenuTargetFromElement)(event.target) ===
                null
            ) &&
              (event.stopPropagation(),
              (value109.current = {
                x: event.clientX,
                y: event.clientY,
              }));
          }}
          onPointerMoveCapture={(): Dynamic => {
            value30 && value31(false);
          }}
          className={(0, runtime.joinClassNames)(
            "relative h-full w-full select-none overflow-clip bg-om-bg-canvas",
            armedTool === "frame" && "cursor-crosshair [&_*]:!cursor-crosshair",
            armedTool === "note" &&
              !value129 &&
              "cursor-default [&_*]:!cursor-default",
            value18 &&
              fullscreenFile == null &&
              (0, runtime.supportsClickPlacement)(armedTool) &&
              (onAddShape
                ? armedTool === "text"
                  ? "cursor-text"
                  : "cursor-crosshair"
                : "cursor-not-allowed"),
          )}
          style={
            value18 &&
            fullscreenFile == null &&
            armedTool === "draw" &&
            onAddPen != null
              ? {
                  cursor: runtime.pickerCursorCss,
                }
              : undefined
          }
          onPointerOver={callback32}
          onPointerMove={(event?: Dynamic): Dynamic => {
            callback32(event);
            if (options.onWorldPointer && value55.current == null) {
              let bounds2: Dynamic =
                  event.currentTarget.getBoundingClientRect(),
                entry2: Dynamic = camera.get();
              options.onWorldPointer(
                entry2.x + (event.clientX - bounds2.left) / entry2.scale,
                entry2.y + (event.clientY - bounds2.top) / entry2.scale,
              );
            }
            if (
              !callback20(event) ||
              value85.current !== "note" ||
              value55.current != null
            ) {
              value75 && value76(null);
              return;
            }
            if (
              event.target instanceof Element &&
              event.target.closest("[data-mega-chrome]") != null &&
              event.target.closest('[data-mega-chrome="focus-overlay"]') == null
            ) {
              value75 && value76(null);
              return;
            }
            let bounds: Dynamic = event.currentTarget.getBoundingClientRect();
            value76({
              x:
                camera.get().x +
                (event.clientX - bounds.left) / camera.get().scale,
              y:
                camera.get().y +
                (event.clientY - bounds.top) / camera.get().scale,
            });
          }}
          onPointerLeave={(): Dynamic => {
            value148.current = null;
            value149.current = null;
            value75 && value76(null);
          }}
          onDragEnter={(input?: Dynamic): Dynamic => {
            onImageDrop &&
              input.dataTransfer?.types.includes("Files") &&
              (value30 || value31(true));
          }}
          onDragOver={(event?: Dynamic): Dynamic => {
            onImageDrop &&
              event.dataTransfer?.types.includes("Files") &&
              (value30 || value31(true),
              event.preventDefault(),
              (event.dataTransfer.dropEffect = callback20(event)
                ? "copy"
                : "none"));
          }}
          onDrop={(event?: Dynamic): Dynamic => {
            value31(false);
            if (!onImageDrop) return;
            let items: Dynamic = [...(event.dataTransfer?.files ?? [])];
            if (
              items.length === 0 ||
              (event.preventDefault(),
              event.stopPropagation(),
              !callback20(event))
            )
              return;
            let bounds: Dynamic = event.currentTarget.getBoundingClientRect();
            onImageDrop(
              items,
              camera.get().x +
                (event.clientX - bounds.left) / camera.get().scale,
              camera.get().y +
                (event.clientY - bounds.top) / camera.get().scale,
            );
          }}
          onContextMenu={(event?: Dynamic): Dynamic => {
            if (
              onCanvasMenu == null ||
              value55.current != null ||
              value128.current ||
              (0, runtime.OutlineDcOutlineHandler)(event.target)
            )
              return;
            if (value108.contextmenu()) return void event.preventDefault();
            let value250: Dynamic =
                callback20(event) && value130.current.size === 0
                  ? (0, runtime.canvasContextMenuTargetFromElement)(
                      event.target,
                    )
                  : null,
              current: Dynamic = value109.current;
            value109.current = null;
            if (value250 === null) return;
            let value251: Dynamic =
              current !== null &&
              Math.hypot(
                event.clientX - current.x,
                event.clientY - current.y,
              ) <= 3;
            if (current !== null && !value251)
              return void event.preventDefault();
            if (
              (event.button >= 0 &&
                !value251 &&
                callback12({
                  pointerType: "mouse",
                  button: 2,
                  target: event.target,
                })) ||
              (event.button < 0 && event.defaultPrevented)
            )
              return;
            event.preventDefault();
            let value252: Dynamic =
                "pointerType" in event.nativeEvent &&
                ["touch", "pen"].includes(
                  String(event.nativeEvent.pointerType),
                ),
              value253: Dynamic =
                event.button < 0 && !value252 && event.target instanceof Element
                  ? event.target.getBoundingClientRect()
                  : null;
            value107(
              value250,
              value253
                ? {
                    x: value253.left,
                    y: value253.bottom,
                    keyboard: true,
                  }
                : {
                    x: event.clientX,
                    y: event.clientY,
                  },
            );
          }}
          onPointerDown={(event?: Dynamic): Dynamic => {
            value108.clear();
            if (!!callback20(event) && !value130.current.has("marquee")) {
              if (
                !value96.current &&
                value85.current === "note" &&
                event.button === 0 &&
                value55.current == null &&
                (!(event.target instanceof Element) ||
                  event.target.closest("[data-mega-chrome]") == null)
              ) {
                event.preventDefault();
                event.stopPropagation();
                (0, runtime.focusCanvasDocument)();
                let bounds: Dynamic =
                  event.currentTarget.getBoundingClientRect();
                onAddAnnotation?.(
                  camera.get().x +
                    (event.clientX - bounds.left) / camera.get().scale,
                  camera.get().y +
                    (event.clientY - bounds.top) / camera.get().scale,
                );
                return;
              }
              if (
                !value96.current &&
                value85.current === "frame" &&
                event.button === 0 &&
                value55.current == null &&
                (!(event.target instanceof Element) ||
                  event.target.closest("[data-mega-chrome]") == null)
              ) {
                event.preventDefault();
                event.stopPropagation();
                (0, runtime.focusCanvasDocument)();
                let bounds: Dynamic =
                    event.currentTarget.getBoundingClientRect(),
                  value250: Dynamic = callback16(
                    event.clientX,
                    event.clientY,
                    bounds,
                  );
                value134("frame-tool", true);
                callback30("frame-tool");
                let callback61: Dynamic = (input?: Dynamic): Dynamic => {
                    let value251: Dynamic = callback16(
                      input.clientX,
                      input.clientY,
                      bounds,
                    );
                    return {
                      x: Math.min(value250.x, value251.x),
                      y: Math.min(value250.y, value251.y),
                      w: Math.abs(value251.x - value250.x),
                      h: Math.abs(value251.y - value250.y),
                    };
                  },
                  callback62: Dynamic = (input?: Dynamic): Dynamic =>
                    value78(callback61(input)),
                  callback63: Dynamic = (input?: Dynamic): Dynamic => {
                    (window as Dynamic).removeEventListener(
                      "pointermove",
                      callback62,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointerup",
                      callback63,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointercancel",
                      callback64,
                    );
                    value78(null);
                    value134("frame-tool", false);
                    let value251: Dynamic = callback61(input);
                    value251.w < 8 && value251.h < 8
                      ? onDrawArtboard?.({
                          x: value251.x,
                          y: value251.y,
                          w: 0,
                          h: 0,
                        })
                      : onDrawArtboard?.({
                          x: Math.round(value251.x),
                          y: Math.round(value251.y),
                          w: Math.round(
                            Math.min(
                              runtime.maximumArtboardSize.w,
                              Math.max(
                                value251.w,
                                runtime.minimumArtboardSize.w,
                              ),
                            ),
                          ),
                          h: Math.round(
                            Math.min(
                              runtime.maximumArtboardSize.h,
                              Math.max(
                                value251.h,
                                runtime.minimumArtboardSize.h,
                              ),
                            ),
                          ),
                        });
                  },
                  callback64: Dynamic = (): Dynamic => {
                    (window as Dynamic).removeEventListener(
                      "pointermove",
                      callback62,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointerup",
                      callback63,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointercancel",
                      callback64,
                    );
                    value78(null);
                    value134("frame-tool", false);
                  };
                (window as Dynamic).addEventListener("pointermove", callback62);
                (window as Dynamic).addEventListener("pointerup", callback63);
                (window as Dynamic).addEventListener(
                  "pointercancel",
                  callback64,
                );
                return;
              }
              if (
                !value96.current &&
                value19.current &&
                (0, runtime.supportsClickPlacement)(value85.current) &&
                event.button === 0 &&
                event.isPrimary &&
                !value79.current &&
                value55.current == null &&
                (!(event.target instanceof Element) ||
                  event.target.closest("[data-mega-chrome]") == null)
              ) {
                event.preventDefault();
                event.stopPropagation();
                (0, runtime.focusCanvasDocument)();
                let current: Dynamic = value85.current,
                  value250: Dynamic =
                    (event.target instanceof Element
                      ? event.target.closest("[data-mega-artboard]")
                      : null
                    )?.getAttribute("data-mega-artboard") ?? null,
                  value251: Dynamic =
                    value250 != null
                      ? manifest.artboards.find(
                          (input?: Dynamic): Dynamic => input.file === value250,
                        )
                      : null,
                  value252: Dynamic =
                    value251?.frameless === true &&
                    value183.current !== value250,
                  value253: Dynamic = value252 ? null : value250,
                  value254: Dynamic = value252 ? null : value251;
                if (
                  value254
                    ? value213.has(value254.file)
                    : value253 != null || !onAddShape
                ) {
                  onPlaceBlocked?.(current, value254 ? "blocked" : "outside");
                  return;
                }
                let bounds: Dynamic =
                    event.currentTarget.getBoundingClientRect(),
                  value255: Dynamic = callback16(
                    event.clientX,
                    event.clientY,
                    bounds,
                  ),
                  pointerId: Dynamic = event.pointerId,
                  callback61: Dynamic = (): Dynamic => camera.get().scale,
                  value256: Dynamic = current === "arrow" || current === "line",
                  callback62: Dynamic = (input?: Dynamic): Dynamic => {
                    let value258: Dynamic = callback16(
                        input.clientX,
                        input.clientY,
                        bounds,
                      ),
                      value259: Dynamic =
                        input.shiftKey && value256
                          ? (0, runtime.constrainLineAngle)(value255, value258)
                          : value258,
                      value260: Dynamic = Math.abs(value259.x - value255.x),
                      value261: Dynamic = Math.abs(value259.y - value255.y);
                    input.shiftKey &&
                      !value256 &&
                      (value260 = value261 = Math.max(value260, value261));
                    return {
                      x:
                        value259.x < value255.x
                          ? value255.x - value260
                          : value255.x,
                      y:
                        value259.y < value255.y
                          ? value255.y - value261
                          : value255.y,
                      w: value260,
                      h: value261,
                      dirX: value259.x >= value255.x ? 1 : -1,
                      dirY: value259.y >= value255.y ? 1 : -1,
                    };
                  };
                value79.current = true;
                value134("place-tool", true);
                let callback63: Dynamic = (input?: Dynamic): Dynamic => {
                    let [items, items2]: Dynamic = [
                      input.w * callback61(),
                      input.h * callback61(),
                    ];
                    return (
                      value256
                        ? items > 4 || items2 > 4
                        : items > 4 && items2 > 4
                    )
                      ? input
                      : {
                          ...input,
                          x: value255.x,
                          y: value255.y,
                          w: 0,
                          h: 0,
                        };
                  },
                  value257: Dynamic = null,
                  callback64: Dynamic = (input?: Dynamic): Dynamic => {
                    if (input.pointerId !== pointerId) return;
                    let value258: Dynamic = callback62(input),
                      value259: Dynamic =
                        (value258.w * value258.w + value258.h * value258.h) *
                        callback61() *
                        callback61();
                    (!value257 && value259 <= 16) ||
                      ((value257 = value258),
                      value81({
                        tool: current,
                        ...value258,
                        onCanvas: !value254,
                      }));
                  },
                  callback65: Dynamic = (): Dynamic => {
                    (window as Dynamic).removeEventListener(
                      "pointermove",
                      callback64,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointerup",
                      callback66,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointercancel",
                      callback67,
                    );
                    (window as Dynamic).removeEventListener(
                      "keydown",
                      callback68,
                      true,
                    );
                    value79.current = false;
                    value81(null);
                    value134("place-tool", false);
                  },
                  callback66: Dynamic = (input?: Dynamic): Dynamic => {
                    if (
                      input.pointerId !== pointerId ||
                      (callback65(), !value19.current)
                    )
                      return;
                    let value258: Dynamic = value257 ?? callback62(input),
                      value259: Dynamic = value257
                        ? callback63(value258)
                        : {
                            ...value258,
                            x: value255.x,
                            y: value255.y,
                            w: 0,
                            h: 0,
                          },
                      state: Dynamic = {
                        x: value258.dirX,
                        y: value258.dirY,
                      },
                      state2: Dynamic = {
                        x: Math.round(value259.x - (value254?.x ?? 0)),
                        y: Math.round(value259.y - (value254?.y ?? 0)),
                        w: Math.round(value259.w),
                        h: Math.round(value259.h),
                      };
                    value254
                      ? onPlaceTool?.(current, value254.file, state2, state)
                      : onAddShape?.(current, state2, state);
                  },
                  callback67: Dynamic = (input?: Dynamic): Dynamic => {
                    input.pointerId === pointerId && callback65();
                  },
                  callback68: Dynamic = (event2?: Dynamic): Dynamic => {
                    event2.key === "Escape" &&
                      (event2.preventDefault(),
                      event2.stopPropagation(),
                      callback65());
                  };
                (window as Dynamic).addEventListener("pointermove", callback64);
                (window as Dynamic).addEventListener("pointerup", callback66);
                (window as Dynamic).addEventListener(
                  "pointercancel",
                  callback67,
                );
                (window as Dynamic).addEventListener(
                  "keydown",
                  callback68,
                  true,
                );
                return;
              }
              if (
                !value96.current &&
                value19.current &&
                value85.current === "draw" &&
                onAddPen &&
                event.button === 0 &&
                event.isPrimary &&
                !value79.current &&
                value55.current == null &&
                event.target instanceof Element &&
                event.target.closest("[data-mega-chrome]") == null &&
                event.target.closest("[data-mega-artboard]") == null
              ) {
                event.preventDefault();
                event.stopPropagation();
                (0, runtime.focusCanvasDocument)();
                let bounds: Dynamic =
                    event.currentTarget.getBoundingClientRect(),
                  pointerId: Dynamic = event.pointerId,
                  items: Dynamic = [[event.clientX, event.clientY]],
                  count: Dynamic = 4,
                  callback61: Dynamic = (): Dynamic =>
                    runtime.freehandSimplifyTolerance / camera.get().scale;
                value79.current = true;
                value134("place-tool", true);
                let callback62: Dynamic = (): Dynamic => {
                    let value250: Dynamic = items.map(
                      ([input, input2]: Dynamic): Dynamic =>
                        callback16(input, input2, bounds),
                    );
                    value83(
                      (0, runtime.freehandDrawingAnnotation)(
                        value250,
                        callback61(),
                        false,
                      ),
                    );
                  },
                  callback63: Dynamic = (input?: Dynamic): Dynamic => {
                    if (input.pointerId !== pointerId) return;
                    let [value250, value251]: Dynamic = items[items.length - 1];
                    (input.clientX - value250) ** 2 +
                      (input.clientY - value251) ** 2 <
                      count ||
                      (items.push([input.clientX, input.clientY]),
                      items.length > 3e3 &&
                        ((items = items.filter(
                          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                            options2 % 2 === 0,
                        )),
                        (count *= 4)),
                      callback62());
                  },
                  callback64: Dynamic = (): Dynamic => {
                    (window as Dynamic).removeEventListener(
                      "pointermove",
                      callback63,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointerup",
                      callback65,
                    );
                    (window as Dynamic).removeEventListener(
                      "pointercancel",
                      callback66,
                    );
                    (window as Dynamic).removeEventListener(
                      "keydown",
                      callback67,
                      true,
                    );
                    value79.current = false;
                    value83(null);
                    value134("place-tool", false);
                  },
                  callback65: Dynamic = (input?: Dynamic): Dynamic => {
                    input.pointerId === pointerId &&
                      (callback64(),
                      !(!value19.current || items.length < 2) &&
                        onAddPen(
                          (0, runtime.freehandDrawingAnnotation)(
                            items.map(
                              ([input2, input3]: Dynamic): Dynamic =>
                                callback16(input2, input3, bounds),
                            ),
                            callback61(),
                          ),
                        ));
                  },
                  callback66: Dynamic = (input?: Dynamic): Dynamic => {
                    input.pointerId === pointerId && callback64();
                  },
                  callback67: Dynamic = (event2?: Dynamic): Dynamic => {
                    event2.key === "Escape" &&
                      (event2.preventDefault(),
                      event2.stopPropagation(),
                      callback64());
                  };
                (window as Dynamic).addEventListener("pointermove", callback63);
                (window as Dynamic).addEventListener("pointerup", callback65);
                (window as Dynamic).addEventListener(
                  "pointercancel",
                  callback66,
                );
                (window as Dynamic).addEventListener(
                  "keydown",
                  callback67,
                  true,
                );
                return;
              }
              if (
                !value96.current &&
                value55.current == null &&
                callback14(event.nativeEvent)
              ) {
                callback19(event, {
                  origin: {
                    kind: "canvas",
                  },
                  mode: (0, runtime.isPrimaryModifierEvent)(event)
                    ? "deep"
                    : "plain",
                  toggle: event.shiftKey,
                  capture: event.currentTarget,
                  onStillRelease: event.shiftKey ? undefined : onClearSelection,
                });
                return;
              }
              (event.target === event.currentTarget ||
                (event.target instanceof Element &&
                  event.target.getAttribute("data-mega-chrome") ===
                    "set-box-pad")) &&
                event.button === 0 &&
                !event.shiftKey &&
                onClearSelection();
              if (
                value55.current == null &&
                (callback13(event.nativeEvent) ||
                  (event.button === 0 && callback10(event.nativeEvent)))
              ) {
                value134("pan", true);
                event.pointerType === "mouse" &&
                  event.currentTarget.setAttribute("data-mega-grabbing", "");
                let value250: Dynamic =
                  event.button === 2 && !value128.current
                    ? (0, runtime.canvasContextMenuTargetFromElement)(
                        event.target,
                      )
                    : null;
                value250 !== null && value108.down(event, value250);
                callback30(
                  "pan",
                  event.button === 1 ? 4 : event.button === 2 ? 2 : 1,
                );
              }
            }
          }}
        >
          <span id={value143} hidden={true}>
            {runtime.PressReturnToGoIntoThisMessage}
          </span>
          <div
            ref={camera.attach}
            data-mega-world={""}
            aria-busy={options.turnBusy ? true : undefined}
            className={"absolute left-0 top-0"}
            style={{
              transformOrigin: "0 0",
            }}
          >
            {value240 &&
              value18 &&
              fullscreenFile == null &&
              (armedTool == null || armedTool === "select") && (
                <div
                  data-mega-chrome={"set-box-pad"}
                  data-testid={"mega-set-box-pad"}
                  className={"absolute cursor-grab"}
                  style={{
                    left: value240.x,
                    top: value240.y,
                    width: value240.w,
                    height: value240.h,
                  }}
                  onPointerDown={(input?: Dynamic): Dynamic => {
                    input.button !== 0 ||
                      input.pointerType === "touch" ||
                      input.shiftKey ||
                      input.metaKey ||
                      input.ctrlKey ||
                      input.altKey ||
                      (input.stopPropagation(),
                      callback53({
                        pointerId: input.pointerId,
                        captureEl: input.currentTarget,
                        clientX: input.clientX,
                        clientY: input.clientY,
                        leader: {
                          box: true,
                        },
                        stillAction: (): Dynamic =>
                          onSelectObjects(
                            runtime.emptyBoardSelection,
                            "replace",
                          ),
                        armWait: null,
                        heldCover: null,
                      }));
                  }}
                />
              )}
            {value224 &&
              fullscreenFile == null &&
              callback7(
                "set-ghost",
                <div
                  data-testid={"mega-set-ghost"}
                  aria-hidden={"true"}
                  className={"pointer-events-none absolute left-0 top-0"}
                  style={{
                    ...runtime.PickerRuntimeScriptTAppAccentConfig,
                    zIndex: 40,
                  }}
                >
                  {value224.map(
                    (input?: Dynamic, options2?: Dynamic): Dynamic => (
                      <div
                        key={options2}
                        className={"absolute rounded-[2px]"}
                        style={{
                          left: input.x,
                          top: input.y,
                          width: input.w,
                          height: input.h,
                          border: "1px dashed var(--t-app-accent)",
                          background:
                            "color-mix(in srgb, var(--t-app-accent) 12%, transparent)",
                        }}
                      />
                    ),
                  )}
                </div>,
              )}
            {options.pendingBoards != null &&
              options.pendingBoards.length > 0 &&
              fullscreenFile == null && (
                <runtime.ConditionalPortal on={value35} to={value50}>
                  <div
                    ref={value35 ? callback5 : undefined}
                    className={
                      "pointer-events-none absolute left-0 top-0 h-0 w-0"
                    }
                    style={{
                      transformOrigin: "0 0",
                      isolation: "isolate",
                    }}
                  >
                    <runtime.PendingArtboards
                      boards={options.pendingBoards}
                      sheen={!value35}
                    />
                  </div>
                </runtime.ConditionalPortal>
              )}
            <runtime.ConditionalPortal on={value35} to={value36}>
              <div
                style={{
                  isolation: "isolate",
                }}
              >
                {value14.map(({ spec: spec, z: z }: Dynamic): Dynamic => {
                  let value250: Dynamic = spec.file === focusedFile,
                    value251: Dynamic = selectedArtboards.has(spec.file),
                    value252: Dynamic = spec.frameless === true,
                    value253: Dynamic = value252 && enteredFile === spec.file,
                    value254: Dynamic =
                      value252 && (emptyPieces?.has(spec.file) ?? false),
                    value255: Dynamic = value144 === spec.file,
                    value256: Dynamic = value189.has(spec.file),
                    value257: Dynamic =
                      spec.title ?? spec.file.replace(/\.dc\.html$/, ""),
                    value258: Dynamic =
                      spec.file === fullscreenFile &&
                      flag &&
                      tweakRows?.[spec.file]
                        ? runtime.artboardTweaksRowHeight
                        : 0,
                    value259: Dynamic = spec.file === playingFile,
                    value260: Dynamic =
                      !value252 &&
                      value250 &&
                      value251 &&
                      value18 &&
                      !value27 &&
                      (armedTool == null || armedTool === "select") &&
                      fullscreenFile == null,
                    value261: Dynamic =
                      !value252 &&
                      value250 &&
                      !value251 &&
                      value18 &&
                      !value27 &&
                      (armedTool == null || armedTool === "select") &&
                      fullscreenFile == null &&
                      onSetMoveCommit != null &&
                      (value228 || armedEmpty === true),
                    value262: Dynamic = value260
                      ? "face-overlay"
                      : value261
                        ? "set-overlay"
                        : "focus-overlay",
                    value263: Dynamic = value221 === spec.file,
                    value264: Dynamic =
                      callback(spec) && !(value250 && value18),
                    value265: Dynamic = value22 && !value264,
                    value266: Dynamic =
                      value265 &&
                      !value259 &&
                      (value252
                        ? !(value253 && value250)
                        : !value250 || value260 || value261 || value263),
                    value267: Dynamic =
                      value252 || fullscreenFile != null
                        ? undefined
                        : (0, runtime.artboardAboveDistances)(
                            manifest.artboards,
                          ).get(spec.file),
                    value268: Dynamic = (0, runtime.shouldHideArtboardTitle)({
                      phoneCanvas: value21,
                      selected: value251,
                      renaming: value104 === spec.file,
                      playing: value259,
                      tweaksOpen: tweaksOpenFile === spec.file,
                      armedByTouch: value250 && value27,
                      hovered: value98 === spec.file,
                    }),
                    value269: Dynamic =
                      phone && !flag && fullscreenFile != null
                        ? (0, runtime.isPreviewHighlighted)(
                            spec.file,
                            fullscreenFile,
                            livePins,
                          )
                        : (!value35 && manifest.artboards.length <= value187) ||
                          value202.has(spec.file) ||
                          (value21
                            ? spec.file === value24
                            : value250 || value259) ||
                          spec.file === fullscreenFile,
                    value270: Dynamic =
                      value21 && !value269 && !value252
                        ? (value39.get(spec.file) ?? null)
                        : null,
                    value271: Dynamic =
                      options.coverFiles?.has(spec.file) === true &&
                      (0, runtime.shouldShowArtboardFaceOverlay)({
                        live: value269,
                        blocked: value213.has(spec.file),
                        frameless: value252,
                        focused: value250,
                        selected: value251,
                        playing: value259,
                        fullWindow: fullscreenFile != null,
                      }),
                    value272: Dynamic =
                      fullscreenFile === spec.file
                        ? (artboardNotice?.(spec.file) ?? null)
                        : null;
                  return (() => {
                    const _Component = "div";
                    const _props = {
                      ref: value35
                        ? callback8(spec.file, spec.x, spec.y)
                        : undefined,
                      "data-mega-artboard": spec.file,
                      "data-mega-selected": value251 ? "" : undefined,
                      className: (0, runtime.joinClassNames)(
                        "absolute",
                        value18 &&
                          !value250 &&
                          !value259 &&
                          fullscreenFile == null &&
                          (0, runtime.supportsClickPlacement)(armedTool) &&
                          (value213.has(spec.file)
                            ? "cursor-not-allowed [&_*]:!cursor-not-allowed"
                            : armedTool === "text"
                              ? "cursor-text [&_*]:!cursor-text"
                              : "cursor-crosshair [&_*]:!cursor-crosshair"),
                      ),
                      style: {
                        ...(value35
                          ? {
                              left: 0,
                              top: 0,
                              transformOrigin: "0 0",
                            }
                          : {
                              left: spec.x,
                              top: spec.y,
                            }),
                        width: spec.w,
                        height: spec.h,
                        zIndex:
                          value117 === spec.file
                            ? 1e6
                            : value35 && value269
                              ? z + runtime.maxCanvasOverlayZIndex
                              : z,
                        ...(fullscreenFile && fullscreenFile !== spec.file
                          ? {
                              display: "none",
                            }
                          : {}),
                        ...(fullscreenFile === spec.file && fullscreenBox
                          ? {
                              width: fullscreenBox.w,
                              height: fullscreenBox.h,
                            }
                          : {}),
                        ...(value258 && !fullscreenBox
                          ? {
                              top: spec.y - value258,
                              height: spec.h + value258,
                            }
                          : {}),
                      },
                      onPointerEnter: (event?: Dynamic): Dynamic => {
                        (!(event.target instanceof HTMLIFrameElement) &&
                          callback22(event, spec.file)) ||
                          (value100.current?.release(), value99(spec.file));
                      },
                      onPointerLeave: (input?: Dynamic): Dynamic => {
                        callback22(input, spec.file) ||
                          (value267 !== undefined &&
                          (0, runtime.isAboveTitleRect)(
                            input.clientX,
                            input.clientY,
                            input.currentTarget.getBoundingClientRect(),
                          )
                            ? callback21(input.currentTarget, spec.file)
                            : value99(null));
                      },
                      children: [
                        value267 !== undefined && value268 && (
                          <runtime.ViewportScaleThreshold
                            min={(0, runtime.artboardTitleHeight)(value267)}
                          >
                            {(input?: Dynamic): Dynamic =>
                              input ? null : (
                                <span hidden={true} data-mega-title-room={""} />
                              )
                            }
                          </runtime.ViewportScaleThreshold>
                        ),
                        fullscreenFile == null && !value252 && (
                          <div
                            data-mega-chrome={"title"}
                            data-proto={
                              onPlayArtboard != null &&
                              !value264 &&
                              (spec.is_interactive === true || value259)
                                ? ""
                                : undefined
                            }
                            data-sel={value251 ? "" : undefined}
                            data-covered={value271 ? "" : undefined}
                            data-testid={"mega-artboard-title-" + spec.file}
                            className={(0, runtime.joinClassNames)(
                              "group/hdr @container/hdr absolute bottom-full left-0 z-30 flex h-6 items-center gap-1.5 [clip-path:inset(-100vmax_0_-100vmax_-8px)] text-xs select-none",
                              value18 ? "cursor-grab" : "cursor-pointer",
                              value256
                                ? "text-pro"
                                : value251
                                  ? "text-accent"
                                  : "text-secondary",
                            )}
                            ref={camera.stamp}
                            style={{
                              width: `calc(${spec.w}px * var(--mega-scale))`,
                              transform: "scale(var(--mega-inv-scale))",
                              transformOrigin: "left bottom",
                              marginBottom: "calc(4px * var(--mega-inv-scale))",
                            }}
                            onPointerDown={(event?: Dynamic): Dynamic => {
                              if (
                                event.button !== 0 ||
                                value104 === spec.file ||
                                !callback20(event)
                              )
                                return;
                              if (
                                (0, runtime.isTouchSelectionStart)(
                                  event.pointerType,
                                  value251,
                                )
                              ) {
                                let shiftKey2: Dynamic = event.shiftKey,
                                  value274: Dynamic =
                                    !shiftKey2 && !event.altKey;
                                (0, runtime.watchPointerRelease)(
                                  event.nativeEvent,
                                  (): Dynamic => {
                                    value60(spec.file, shiftKey2);
                                    value265 &&
                                      value274 &&
                                      !value259 &&
                                      !artboardPicking &&
                                      onFocus(spec.file);
                                  },
                                );
                                return;
                              }
                              let shiftKey: Dynamic = event.shiftKey;
                              if (
                                onSetMoveCommit &&
                                event.pointerType !== "touch" &&
                                !shiftKey &&
                                !event.altKey &&
                                (0, runtime.hasBoardSelection)(
                                  value57.current,
                                  {
                                    file: spec.file,
                                  },
                                ) &&
                                callback54()
                              ) {
                                let value274: Dynamic =
                                  value265 && !value259 && !artboardPicking;
                                callback53({
                                  pointerId: event.pointerId,
                                  captureEl: event.currentTarget,
                                  clientX: event.clientX,
                                  clientY: event.clientY,
                                  leader: {
                                    canvas: {
                                      file: spec.file,
                                    },
                                  },
                                  stillAction: (): Dynamic => {
                                    onSelectObjects(
                                      (0, runtime.boardSelectionItems)({
                                        file: spec.file,
                                      }),
                                      "replace",
                                    );
                                    value274 && onFocus(spec.file);
                                  },
                                  armWait: null,
                                  heldCover: null,
                                });
                                return;
                              }
                              let value273: Dynamic = (0,
                              runtime.selectionPointerDownDecision)(
                                value57.current,
                                {
                                  file: spec.file,
                                },
                                shiftKey,
                              );
                              value273.selectNow &&
                                value60(spec.file, shiftKey);
                              callback46(
                                event,
                                {
                                  file: spec.file,
                                },
                                spec,
                                value273.carry,
                                value273.click,
                                value265 &&
                                  !shiftKey &&
                                  !value259 &&
                                  !artboardPicking,
                              );
                            }}
                            onPointerMove={(input?: Dynamic): Dynamic =>
                              callback50(input, false)
                            }
                            onPointerUp={(input?: Dynamic): Dynamic =>
                              callback50(input, true)
                            }
                            onPointerCancel={(input?: Dynamic): Dynamic =>
                              callback49(input)
                            }
                            onDoubleClick={(input?: Dynamic): Dynamic => {
                              callback20(input) &&
                                onRenameArtboard &&
                                value18 &&
                                ((value106.current = false),
                                value255 && keyboard2?.onAbandon(),
                                value105(spec.file));
                            }}
                          >
                            {value104 === spec.file ? (
                              <input
                                data-mega-chrome={"rename"}
                                data-testid={
                                  "mega-artboard-rename-" + spec.file
                                }
                                aria-label={"Artboard name"}
                                defaultValue={value257}
                                autoFocus={true}
                                onFocus={(input?: Dynamic): Dynamic =>
                                  input.currentTarget.select()
                                }
                                className={
                                  "min-w-0 flex-1 rounded-sm bg-page px-1 text-primary ring-1 ring-fill-accent outline-none focus-visible:outline-hidden"
                                }
                                style={{
                                  font: "inherit",
                                }}
                                onPointerDown={(input?: Dynamic): Dynamic =>
                                  input.stopPropagation()
                                }
                                onKeyDown={(input?: Dynamic): Dynamic => {
                                  input.stopPropagation();
                                  input.key === "Enter"
                                    ? input.currentTarget.blur()
                                    : input.key === "Escape" &&
                                      ((value106.current = true),
                                      value105(null));
                                }}
                                onBlur={(input?: Dynamic): Dynamic => {
                                  if (value106.current) {
                                    value106.current = false;
                                    return;
                                  }
                                  value105(null);
                                  onRenameArtboard?.(
                                    spec.file,
                                    input.currentTarget.value,
                                  );
                                }}
                              />
                            ) : (
                              <runtime.ArtboardFocusOverlay
                                file={spec.file}
                                title={value257}
                                name={(0, runtime.artboardPositionAnnouncement)(
                                  entries.get(spec.file) ?? -1,
                                  entries.size,
                                  value257,
                                )}
                                hintId={
                                  value265 && keyboard2 && !artboardPicking
                                    ? value143
                                    : undefined
                                }
                                selected={value251}
                                inside={value255}
                                testId={"mega-artboard-handle-" + spec.file}
                                inert={value126}
                                onActivate={value158}
                                keys={
                                  value265 && !artboardPicking
                                    ? keyboard2?.keys
                                    : undefined
                                }
                                yieldsEscape={value145}
                              />
                            )}
                            {value255 && value104 !== spec.file && (
                              <span
                                aria-hidden={"true"}
                                data-mega-chrome={"inside-caption"}
                                data-testid={
                                  "mega-artboard-inside-caption-" + spec.file
                                }
                                className={
                                  "hidden shrink-0 whitespace-nowrap rounded-sm bg-page px-1 text-[11px] text-secondary ring-1 ring-(--cds-border) peer-focus:block"
                                }
                              >
                                {
                                  runtime.AccessibilityAnnouncementsResolvedValue
                                }
                              </span>
                            )}
                            {!value271 && (
                              <runtime.ArtboardHeaderActions
                                file={spec.file}
                                title={value257}
                                inert={value126}
                                editable={editable}
                                tweaks={
                                  value &&
                                  onToggleTweaks != null &&
                                  !value264 &&
                                  tweakRows?.[spec.file] === true &&
                                  value104 !== spec.file
                                }
                                tweaksOpen={tweaksOpenFile === spec.file}
                                play={
                                  value &&
                                  onPlayArtboard != null &&
                                  (value259 ||
                                    (!value264 &&
                                      spec.is_interactive === true)) &&
                                  value104 !== spec.file
                                    ? value259
                                      ? value18
                                        ? "edit"
                                        : "stop"
                                      : "play"
                                    : null
                                }
                                expand={
                                  value &&
                                  onExpandArtboard != null &&
                                  value104 !== spec.file
                                }
                                download={
                                  value &&
                                  onExportArtboard != null &&
                                  !value21 &&
                                  value104 !== spec.file
                                }
                                exportDisabledReason={exportDisabledReason}
                                problem={
                                  value && !value264 && value104 !== spec.file
                                    ? artboardProblems?.get(spec.file)?.[0]
                                    : undefined
                                }
                                onShowProblems={value155}
                                exportOpen={
                                  value110?.open === true &&
                                  value110.file === spec.file
                                }
                                exportItems={
                                  value110?.file === spec.file
                                    ? (0, runtime.renderMenuItems)(
                                        (0, runtime.artboardExportMenuItems)(
                                          spec.file,
                                          manifest.artboards,
                                          {
                                            onExportArtboard: onExportArtboard,
                                            onExportArtboardPdf:
                                              onExportArtboardPdf,
                                            onExportArtboardHtmlZip:
                                              onExportArtboardHtmlZip,
                                            onExportAllArtboardsPdf:
                                              onExportAllArtboardsPdf,
                                            onExportSelectedArtboardsPdf:
                                              onExportSelectedArtboardsPdf,
                                          },
                                          selectedArtboards,
                                          exportRules,
                                        ),
                                      )
                                    : null
                                }
                                onToggleTweaks={value151}
                                onPlay={value157}
                                onExpand={value156}
                                onExportOpenChange={value173}
                              />
                            )}
                          </div>
                        ),
                        value272 != null && (
                          <runtime.ArtboardNoticePlane
                            w={fullscreenBox?.w ?? spec.w}
                            full={true}
                            inert={value126}
                            stamp={camera.stamp}
                          >
                            {value272}
                          </runtime.ArtboardNoticePlane>
                        ),
                        value251 && fullscreenFile == null && (
                          <div
                            data-mega-chrome={"resize"}
                            data-testid={"mega-artboard-resize-" + spec.file}
                            className={
                              "pointer-events-none absolute inset-0 z-[29]"
                            }
                          >
                            <runtime.ViewportScale>
                              {(input?: Dynamic): Dynamic => (
                                <runtime.SelectionRing
                                  frame={{
                                    x: 0,
                                    y: 0,
                                    w: spec.w,
                                    h: spec.h,
                                  }}
                                  scale={input}
                                  state={value232 ? "member" : "selected"}
                                  variant={value256 ? "component" : "object"}
                                  grips={
                                    value18 &&
                                    !value252 &&
                                    !value232 &&
                                    !(value228 && fullscreenFile == null)
                                      ? "corners"
                                      : "none"
                                  }
                                  onResizeStart={(
                                    input2?: Dynamic,
                                    options2?: Dynamic,
                                  ): Dynamic => {
                                    let state: Dynamic = {
                                        x: spec.x,
                                        y: spec.y,
                                        w: spec.w,
                                        h: spec.h,
                                      },
                                      [items, items2]: Dynamic = [
                                        options2.clientX,
                                        options2.clientY,
                                      ],
                                      items3: Dynamic = [
                                        ...(input2.x
                                          ? input2.x === "left"
                                            ? ["x", "w"]
                                            : ["w"]
                                          : []),
                                        ...(input2.y
                                          ? input2.y === "top"
                                            ? ["y", "h"]
                                            : ["h"]
                                          : []),
                                      ],
                                      value273: Dynamic =
                                        input2.x !== null && input2.y !== null,
                                      value274: Dynamic = callback45({
                                        files: [spec.file],
                                      }),
                                      callback61: Dynamic = (
                                        input3?: Dynamic,
                                      ): Dynamic => {
                                        let scale: Dynamic = camera.get().scale,
                                          state2: Dynamic = {
                                            dx:
                                              (input3.clientX - items) / scale,
                                            dy:
                                              (input3.clientY - items2) / scale,
                                          },
                                          value276: Dynamic =
                                            input3.metaKey || input3.ctrlKey
                                              ? {
                                                  ...state2,
                                                  guides: [],
                                                }
                                              : (0, runtime.snapResize)(
                                                  state,
                                                  input2,
                                                  state2.dx,
                                                  state2.dy,
                                                  value274,
                                                  runtime.canvasTouchDragThresholdPixels /
                                                    scale,
                                                ),
                                          [items4, items5]: Dynamic = [
                                            Math.round(value276.dx),
                                            Math.round(value276.dy),
                                          ],
                                          value277: Dynamic =
                                            value273 && input3.shiftKey
                                              ? (0,
                                                runtime.resizeRectKeepingAspect)(
                                                  state,
                                                  input2,
                                                  items4,
                                                  items5,
                                                  runtime.minimumArtboardSize,
                                                  runtime.maximumArtboardSize,
                                                )
                                              : (0, runtime.resizeRect)(
                                                  state,
                                                  input2,
                                                  items4,
                                                  items5,
                                                  runtime.minimumArtboardSize,
                                                  runtime.maximumArtboardSize,
                                                ),
                                          value278: Dynamic =
                                            value273 && input3.shiftKey
                                              ? {
                                                  x: Math.round(value277.x),
                                                  y: Math.round(value277.y),
                                                  w: Math.round(value277.w),
                                                  h: Math.round(value277.h),
                                                }
                                              : value277;
                                        return {
                                          box: value278,
                                          guides: (0,
                                          runtime.activeResizeGuides)(
                                            value278,
                                            input2,
                                            value276.guides,
                                          ),
                                        };
                                      },
                                      callback62: Dynamic = (
                                        input3?: Dynamic,
                                      ): Dynamic =>
                                        Object.fromEntries(
                                          items3.map(
                                            (input4?: Dynamic): Dynamic => [
                                              input4,
                                              input3[input4],
                                            ],
                                          ),
                                        ),
                                      callback63: Dynamic = (
                                        input3?: Dynamic,
                                        options3?: Dynamic,
                                      ): Dynamic => {
                                        let value276: Dynamic =
                                          value146.current.artboards.find(
                                            (input4?: Dynamic): Dynamic =>
                                              input4.file === spec.file,
                                          );
                                        onManifestChange(
                                          (0, runtime.replaceDesignArtboards)(
                                            value146.current,
                                            value146.current.artboards.map(
                                              (input4?: Dynamic): Dynamic =>
                                                input4.file === spec.file
                                                  ? {
                                                      ...input4,
                                                      ...callback62(input3),
                                                    }
                                                  : input4,
                                            ),
                                          ),
                                          options3,
                                          options3 && value276
                                            ? {
                                                resizedFrom: {
                                                  file: spec.file,
                                                  x: value276.x,
                                                  y: value276.y,
                                                  w: value276.w,
                                                  h: value276.h,
                                                  ...callback62(state),
                                                },
                                              }
                                            : undefined,
                                        );
                                      },
                                      value275: Dynamic = state;
                                    callback57(options2, "resize", {
                                      live: (input3?: Dynamic): Dynamic => {
                                        let value276: Dynamic =
                                          callback61(input3);
                                        value275 = value276.box;
                                        callback63(value275, false);
                                        value70(
                                          value276.guides.length > 0
                                            ? value276.guides
                                            : null,
                                        );
                                      },
                                      commit: (): Dynamic =>
                                        callback63(value275, true),
                                      revert: (): Dynamic =>
                                        callback63(state, false),
                                      end: (): Dynamic => value70(null),
                                    });
                                  }}
                                />
                              )}
                            </runtime.ViewportScale>
                          </div>
                        ),
                        options.artboardOverlay && (
                          <runtime.ArtboardOverlayPlane
                            a={spec}
                            fullscreenFile={fullscreenFile ?? null}
                            fullscreenBox={fullscreenBox ?? null}
                            rowH={value258}
                            overlay={options.artboardOverlay}
                          />
                        ),
                        (fullscreenFile == null ||
                          (value22 && fullscreenFile === spec.file)) && (
                          <div
                            ref={callback23(spec.file)}
                            data-mega-chrome={"element"}
                            className={(0, runtime.joinClassNames)(
                              "pointer-events-none absolute left-0",
                              value117 === spec.file ? "z-[31]" : "z-[29]",
                            )}
                            style={
                              fullscreenFile === spec.file && fullscreenBox
                                ? {
                                    top: value258,
                                    width: fullscreenBox.w,
                                    height: fullscreenBox.h - value258,
                                    ...runtime.PickerRuntimeScriptTAppAccentConfig,
                                  }
                                : {
                                    top: value258,
                                    width: spec.w,
                                    height: spec.h,
                                    ...runtime.PickerRuntimeScriptTAppAccentConfig,
                                  }
                            }
                          />
                        ),
                        value271 && (
                          <runtime.PendingArtboardTitle
                            spec={spec}
                            tone={value256 ? "component" : "arrived"}
                            className={"z-30"}
                          />
                        ),
                        <div
                          data-testid={"mega-artboard-frame-" + spec.file}
                          data-empty-piece={value254 || undefined}
                          className={(0, runtime.joinClassNames)(
                            "relative flex h-full w-full flex-col overflow-clip",
                            value252
                              ? value254
                                ? "rounded border-[1.5px] border-dashed border-(--cds-text-secondary)"
                                : value253
                                  ? "ring-1 ring-app-accent/50"
                                  : value269
                                    ? value265 &&
                                      !value251 &&
                                      "hover:ring-1 hover:ring-(--cds-border)/60"
                                    : "ring-1 ring-(--cds-border)"
                              : "bg-white",
                            !value252 &&
                              !fullscreenBox &&
                              !value271 &&
                              "shadow-md",
                            !value252 &&
                              !fullscreenBox &&
                              !value271 &&
                              (fullscreenFile != null || !value251) &&
                              (value250 && value265
                                ? "ring-1 ring-app-accent/50"
                                : value256
                                  ? "ring-1 ring-(--cds-fill-pro)"
                                  : "ring-1 ring-(--cds-border)"),
                          )}
                          style={{
                            ...runtime.PickerRuntimeScriptTAppAccentConfig,
                            borderRadius:
                              value252 || fullscreenBox
                                ? undefined
                                : (0, runtime.artboardRadiusCss)(spec.radius),
                          }}
                        >
                          <runtime.ArtboardFrame
                            file={spec.file}
                            displayTitle={value257}
                            title={spec.title}
                            live={value269}
                            expanded={spec.file === fullscreenFile}
                            onPagePointer={options.onPagePointer}
                            onPageScroll={options.onPageScroll}
                            migrated={flag}
                            frameless={value252}
                            onContentHull={onContentHull}
                            box={
                              fullscreenFile === spec.file && fullscreenBox
                                ? fullscreenBox
                                : callback31(spec)
                            }
                            boxRowH={
                              fullscreenFile === spec.file && fullscreenBox
                                ? value258
                                : 0
                            }
                            component={value256}
                            chromeSlot={value101.get(spec.file) ?? null}
                            onHostGesture={value134}
                            onTweaksRow={onTweaksRow}
                            onTweaksDirty={onTweaksDirty}
                            onOpenTweaks={onOpenTweaks && value150}
                            canvasScaleRef={canvasScaleRef}
                            assets={assets}
                            doc={doc}
                            focused={value250}
                            editing={value18 && !value259}
                            gripless={
                              value228 &&
                              value250 &&
                              onSetMoveCommit != null &&
                              fullscreenFile == null
                            }
                            panelMounted={value265 && value250 && !value259}
                            vectorEdit={armedTool === "vector"}
                            playing={value259}
                            readOnly={!value18 || value259}
                            frameArmed={frameArmed}
                            editable={editable}
                            onHandle={value3}
                            onPreviewDropNotice={value153}
                            onHistoryPush={onHistoryPush}
                            onModelReparsed={onModelReparsed}
                            onHistoryApply={onHistoryApply}
                            onHistoryRevoke={onHistoryRevoke}
                            onHistoryDrop={onHistoryDrop}
                            onTweakEdit={onTweakEdit}
                            sessionEpoch={sessionEpoch}
                            actionsRef={actionsRef}
                            onSelection={onSelectionEvent}
                            onSelectionSeq={onSelectionSeq}
                            onGestureStream={value139}
                            onTextEditState={value142}
                            onTextEditEnded={keyboard2?.onTextEditEnded}
                            keyboardSkipsContent={value265 && !value253}
                            onReadyGen={onArtboardReady}
                            dsVarNames={dsVarNames}
                            onDefinedVars={onDefinedVars}
                            onBlockedChange={value215}
                            onProblemsChange={onArtboardProblems}
                            routeForwardedKey={routeForwardedKey}
                            onDragEvent={value93}
                            onBoxEvent={onBoxEvent}
                            onModifierKey={value135}
                            onPanZoom={value66}
                            onRepeatRefused={onRepeatRefused}
                            onPreviewClick={
                              value265 || value259 ? undefined : value60
                            }
                            keyboardInert={value126}
                            inertFrame={value264}
                            pointerInert={
                              value126 ||
                              value43 === spec.file ||
                              (streamDragFile != null &&
                                streamDragFile !== spec.file) ||
                              (value18 &&
                                !value259 &&
                                armedTool === "note" &&
                                fullscreenFile == null) ||
                              (value18 &&
                                !(value250 && (!value252 || value253)) &&
                                !value259 &&
                                (0, runtime.supportsClickPlacement)(
                                  armedTool,
                                ) &&
                                fullscreenFile == null)
                            }
                            exitGuardRef={exitGuardRef}
                            textEditOpenRef={textEditOpenRef}
                            settleSessionRef={settleSessionRef}
                            commitOpenTextEditRef={commitOpenTextEditRef}
                            onSessionDirtyChange={onSessionDirtyChange}
                            onEditInput={onEditInput}
                            onLocalEdit={onLocalEdit}
                            onUndoStack={onUndoStack}
                            onToolChange={onToolChange}
                            toolResetTick={toolResetTick}
                            onOpenFile={onOpenFile && value152}
                            onPasteImages={value179}
                            onDropVideos={value180}
                            onPointerPresence={value174}
                            onPointerAt={value175}
                            artboardSettings={
                              value250 ? artboardSettings : undefined
                            }
                            canvasObject={value250 ? canvasObject : null}
                            outlineArtboards={value250 ? value193 : null}
                            presentPropsTick={presentPropsTick}
                            onPresentPropsHandled={onPresentPropsHandled}
                            placeRequest={
                              placeRequest?.file === spec.file
                                ? placeRequest
                                : null
                            }
                            onPlaceHandled={onPlaceHandled}
                          />
                          {options.guidesVisible &&
                            spec.guides !== undefined &&
                            fullscreenFile == null &&
                            !value259 &&
                            (value269 ? (
                              <runtime.ArtboardLayoutGuides
                                guides={spec.guides}
                                w={spec.w}
                                h={spec.h}
                              />
                            ) : (
                              <runtime.CanvasRectVisibility
                                rect={spec}
                                surfaceRef={value9}
                              >
                                {(input?: Dynamic): Dynamic =>
                                  input && spec.guides ? (
                                    <runtime.ArtboardLayoutGuides
                                      guides={spec.guides}
                                      w={spec.w}
                                      h={spec.h}
                                    />
                                  ) : null
                                }
                              </runtime.CanvasRectVisibility>
                            ))}
                          {(!value269 || value264) &&
                            !value213.has(spec.file) && (
                              <runtime.CanvasRectVisibility
                                rect={spec}
                                surfaceRef={value9}
                              >
                                {(input?: Dynamic): Dynamic => (
                                  <div
                                    data-testid={
                                      (value269
                                        ? "mega-artboard-open-"
                                        : "mega-artboard-offloaded-") +
                                      spec.file
                                    }
                                    ref={
                                      value264
                                        ? runtime.preventTouchScroll
                                        : undefined
                                    }
                                    role={"button"}
                                    tabIndex={value265 ? -1 : 0}
                                    inert={
                                      (!input && !value264) || value126
                                        ? true
                                        : undefined
                                    }
                                    aria-label={
                                      (value264
                                        ? "Open artboard "
                                        : "Load artboard ") + value257
                                    }
                                    className={
                                      "absolute inset-0 z-10 flex cursor-pointer items-center justify-center overflow-hidden select-none"
                                    }
                                    style={
                                      value269
                                        ? undefined
                                        : value21
                                          ? value270
                                            ? {
                                                backgroundColor: value270.bg,
                                              }
                                            : undefined
                                          : {
                                              backgroundImage:
                                                "repeating-linear-gradient(135deg, transparent 0 10px, var(--om-bg-canvas) 10px 20px)",
                                            }
                                    }
                                    onPointerDown={(
                                      event?: Dynamic,
                                    ): Dynamic => {
                                      if (
                                        event.button !== 0 ||
                                        value85.current === "note" ||
                                        value85.current === "frame" ||
                                        (0, runtime.supportsClickPlacement)(
                                          value85.current,
                                        )
                                      )
                                        return;
                                      let shiftKey: Dynamic = event.shiftKey;
                                      (0, runtime.watchPointerRelease)(
                                        event.nativeEvent,
                                        (): Dynamic =>
                                          callback42(spec.file, shiftKey),
                                      );
                                    }}
                                    {...(0, runtime.buttonKeyboardActivation)(
                                      (input2?: Dynamic): Dynamic =>
                                        callback42(
                                          spec.file,
                                          input2.shiftKey || input2.metaKey,
                                        ),
                                    )}
                                    onClick={(input2?: Dynamic): Dynamic => {
                                      input2.detail === 0 &&
                                        callback42(
                                          spec.file,
                                          input2.shiftKey || input2.metaKey,
                                        );
                                    }}
                                  >
                                    {value21 && !value269 && !value252 && (
                                      <runtime.RunWhenSeen
                                        seen={input}
                                        then={(): Dynamic => value42(spec.file)}
                                      />
                                    )}
                                    {!value269 && (
                                      <runtime.ViewportScaleThreshold
                                        min={
                                          value21
                                            ? Math.max(
                                                runtime.canvasHandleLabelSize
                                                  .w / spec.w,
                                                runtime.canvasHandleLabelSize
                                                  .h / spec.h,
                                              )
                                            : 0
                                        }
                                      >
                                        {(input2?: Dynamic): Dynamic =>
                                          input2 && (
                                            <span
                                              ref={camera.stamp}
                                              className={(0,
                                              runtime.joinClassNames)(
                                                "shrink-0 whitespace-nowrap px-2.5 py-1 text-xs",
                                                !value270 && "text-secondary",
                                                value21
                                                  ? "opacity-50"
                                                  : "opacity-[0.15]",
                                              )}
                                              style={{
                                                transform:
                                                  "scale(var(--mega-inv-scale))",
                                                ...(value270
                                                  ? {
                                                      color: value270.lightInk
                                                        ? "#fff"
                                                        : "#141413",
                                                    }
                                                  : {}),
                                              }}
                                            >
                                              <span
                                                className={
                                                  "pointer-coarse:hidden"
                                                }
                                              >
                                                {"Click to load"}
                                              </span>
                                              <span
                                                className={
                                                  "hidden pointer-coarse:inline"
                                                }
                                              >
                                                {value264
                                                  ? "Tap to open"
                                                  : "Tap to load"}
                                              </span>
                                            </span>
                                          )
                                        }
                                      </runtime.ViewportScaleThreshold>
                                    )}
                                  </div>
                                )}
                              </runtime.CanvasRectVisibility>
                            )}
                          {value266 && (
                            <div
                              data-mega-chrome={value262}
                              data-testid={
                                runtime.artboardOverlayIdPrefixes[value262] +
                                spec.file
                              }
                              className={(0, runtime.joinClassNames)(
                                "absolute inset-0 z-20",
                                (value252 || value251 || value261) && value18
                                  ? "cursor-grab"
                                  : "cursor-pointer",
                                (armedTool === "note" ||
                                  (0, runtime.supportsClickPlacement)(
                                    armedTool,
                                  )) &&
                                  fullscreenFile == null &&
                                  "pointer-events-none",
                                (0, runtime.shouldPassFileDropThroughOverlay)({
                                  chrome: value262,
                                  filesDrag: value30,
                                }) && "pointer-events-none",
                              )}
                              {...(value252
                                ? {
                                    "data-mega-piece": "",
                                    role: "button",
                                    tabIndex: 0,
                                    inert: value126 ? true : undefined,
                                    "aria-label": value257,
                                    "aria-pressed": value251,
                                    ...(0, runtime.buttonKeyboardActivation)(
                                      (input?: Dynamic): Dynamic => {
                                        input.key === "Enter" &&
                                        value22 &&
                                        value18 &&
                                        !input.shiftKey &&
                                        !input.metaKey
                                          ? onEnterPiece?.(
                                              spec.file,
                                              spec.w / 2,
                                              spec.h / 2,
                                            )
                                          : value60(
                                              spec.file,
                                              input.shiftKey || input.metaKey,
                                            );
                                      },
                                    ),
                                    onClick: (input?: Dynamic): Dynamic => {
                                      input.detail === 0 &&
                                        (value22 &&
                                        value18 &&
                                        !input.shiftKey &&
                                        !input.metaKey
                                          ? onEnterPiece?.(
                                              spec.file,
                                              spec.w / 2,
                                              spec.h / 2,
                                            )
                                          : value60(
                                              spec.file,
                                              input.shiftKey || input.metaKey,
                                            ));
                                    },
                                    onDoubleClick: (
                                      event?: Dynamic,
                                    ): Dynamic => {
                                      value18 &&
                                        onEnterPiece?.(
                                          spec.file,
                                          event.nativeEvent.offsetX,
                                          event.nativeEvent.offsetY,
                                        );
                                    },
                                  }
                                : {
                                    onDoubleClick: (
                                      event?: Dynamic,
                                    ): Dynamic => {
                                      if (
                                        event.shiftKey ||
                                        event.metaKey ||
                                        event.ctrlKey ||
                                        event.altKey ||
                                        !onFaceDoubleClick ||
                                        !value18 ||
                                        value27 ||
                                        (armedTool != null &&
                                          armedTool !== "select") ||
                                        fullscreenFile != null
                                      )
                                        return;
                                      let state: Dynamic = {
                                        x: event.nativeEvent.offsetX,
                                        y: event.nativeEvent.offsetY,
                                      };
                                      (
                                        value29.current ?? Promise.resolve()
                                      ).then(
                                        (): Dynamic =>
                                          onFaceDoubleClick(spec.file, state),
                                      );
                                    },
                                  })}
                              onPointerDown={(event?: Dynamic): Dynamic => {
                                value32();
                                if (event.button !== 0) return;
                                let shiftKey: Dynamic = event.shiftKey;
                                if (value252) {
                                  if (
                                    (0, runtime.isTouchSelectionStart)(
                                      event.pointerType,
                                      value251,
                                    )
                                  ) {
                                    (0, runtime.watchPointerRelease)(
                                      event.nativeEvent,
                                      (): Dynamic =>
                                        value60(spec.file, shiftKey),
                                    );
                                    return;
                                  }
                                  if (
                                    onSetMoveCommit &&
                                    event.pointerType !== "touch" &&
                                    !shiftKey &&
                                    !event.altKey &&
                                    (0, runtime.hasBoardSelection)(
                                      value57.current,
                                      {
                                        file: spec.file,
                                      },
                                    ) &&
                                    callback54()
                                  ) {
                                    callback53({
                                      pointerId: event.pointerId,
                                      captureEl: event.currentTarget,
                                      clientX: event.clientX,
                                      clientY: event.clientY,
                                      leader: {
                                        canvas: {
                                          file: spec.file,
                                        },
                                      },
                                      stillAction: (): Dynamic =>
                                        value60(spec.file, false),
                                      armWait: null,
                                      heldCover: null,
                                    });
                                    return;
                                  }
                                  let value275: Dynamic = (0,
                                  runtime.selectionPointerDownDecision)(
                                    value57.current,
                                    {
                                      file: spec.file,
                                    },
                                    shiftKey,
                                  );
                                  value275.selectNow &&
                                    value60(spec.file, shiftKey);
                                  callback46(
                                    event,
                                    {
                                      file: spec.file,
                                    },
                                    spec,
                                    value275.carry,
                                    value275.click,
                                  );
                                  return;
                                }
                                let value273: Dynamic = (0,
                                  runtime.canvasFacePointerAction)({
                                    editing: value18,
                                    pointerType: event.pointerType,
                                    tool: armedTool,
                                    fullscreen: fullscreenFile != null,
                                    faceOverlay: value260,
                                  }),
                                  value274: Dynamic = (0,
                                  runtime.isPrimaryModifierEvent)(event),
                                  state: Dynamic = {
                                    x: event.nativeEvent.offsetX,
                                    y: event.nativeEvent.offsetY,
                                  },
                                  callback61: Dynamic = (
                                    input?: Dynamic,
                                  ): Dynamic => {
                                    value273 === "pick" &&
                                    !(value261 && event.pointerType === "touch")
                                      ? callback18(event, spec, {
                                          toggle: shiftKey,
                                          deepKey: value274,
                                          still: input,
                                          face: value260,
                                          kind: value260
                                            ? "face"
                                            : value261
                                              ? "set"
                                              : "focus",
                                          at: state,
                                        })
                                      : value273 === "leave"
                                        ? value60(spec.file, true)
                                        : (value60(spec.file, shiftKey),
                                          shiftKey || onFocus(spec.file));
                                  };
                                if (event.pointerType === "touch") {
                                  (0, runtime.watchPointerRelease)(
                                    event.nativeEvent,
                                    (): Dynamic => callback61(true),
                                  );
                                  return;
                                }
                                if (
                                  value18 &&
                                  value251 &&
                                  !shiftKey &&
                                  !event.altKey &&
                                  !value274 &&
                                  fullscreenFile == null
                                ) {
                                  if (onSetMoveCommit && callback54()) {
                                    callback53({
                                      pointerId: event.pointerId,
                                      captureEl: event.currentTarget,
                                      clientX: event.clientX,
                                      clientY: event.clientY,
                                      leader: {
                                        canvas: {
                                          file: spec.file,
                                        },
                                      },
                                      stillAction: (): Dynamic =>
                                        callback61(true),
                                      armWait: null,
                                      heldCover: null,
                                    });
                                    return;
                                  }
                                  value68.current = (): Dynamic =>
                                    callback61(true);
                                  callback46(
                                    event,
                                    {
                                      file: spec.file,
                                    },
                                    spec,
                                    value57.current,
                                    null,
                                  );
                                  return;
                                }
                                if (
                                  event.altKey &&
                                  !shiftKey &&
                                  !value261 &&
                                  onDuplicateObjects &&
                                  fullscreenFile == null
                                ) {
                                  let value275: Dynamic = (0,
                                  runtime.selectionPointerDownDecision)(
                                    value57.current,
                                    {
                                      file: spec.file,
                                    },
                                    false,
                                  );
                                  value275.selectNow &&
                                    value60(spec.file, false);
                                  callback46(
                                    event,
                                    {
                                      file: spec.file,
                                    },
                                    spec,
                                    value275.carry,
                                    value275.click,
                                  );
                                  return;
                                }
                                callback61(false);
                              }}
                              onPointerMove={(input?: Dynamic): Dynamic => {
                                callback50(input, false);
                                value252 || callback3(spec.file, input);
                              }}
                              onPointerUp={(input?: Dynamic): Dynamic => {
                                let [items, items2]: Dynamic = [
                                  value67.current,
                                  value68.current,
                                ];
                                value68.current = null;
                                callback50(input, true);
                                items2 &&
                                  items &&
                                  items.pointerId === input.pointerId &&
                                  !items.live &&
                                  items2();
                              }}
                              onPointerCancel={(input?: Dynamic): Dynamic => {
                                value68.current = null;
                                callback49(input);
                              }}
                              onPointerLeave={value32}
                            />
                          )}
                          {value271 && (
                            <runtime.PendingArtboardFace
                              spec={spec}
                              sheen={false}
                              className={"z-[16]"}
                            />
                          )}
                        </div>,
                      ],
                    } as const;
                    const _key = spec.file;
                    return <_Component key={_key} {..._props} />;
                  })();
                })}
              </div>
            </runtime.ConditionalPortal>
            {fullscreenFile == null &&
              ((): Dynamic => {
                let value250: Dynamic = (manifest.annotations ?? []).map(
                  (source?: Dynamic): Dynamic => {
                    let value251: Dynamic = (0, runtime.isShapeAnnotation)(
                      source,
                    )
                      ? (() => {
                          const _Component2 = runtime.CanvasShape;
                          const _props2 = {
                            spec:
                              value114?.id === source.id &&
                              source.kind === "image"
                                ? (0, runtime.updateAnnotationCrop)(
                                    {
                                      ...source,
                                      ...callback27(value114),
                                    },
                                    value114.live,
                                  )
                                : source,
                            cropping: value114?.id === source.id,
                            onCropStart: (): Dynamic => callback28(source.id),
                            onPictureLoad: value119,
                            scale: entry.scale,
                            editing: value18,
                            inert:
                              (0, runtime.supportsClickPlacement)(armedTool) ||
                              armedTool === "draw",
                            commenting: value126,
                            selected: selectedNotes.has(source.id),
                            grouped: value232,
                            objectPress: callback55(source),
                            onChange: (
                              input?: Dynamic,
                              options2?: Dynamic,
                            ): Dynamic =>
                              callback34(
                                source.id,
                                (input2?: Dynamic): Dynamic =>
                                  (0, runtime.isShapeAnnotation)(input2)
                                    ? {
                                        ...input2,
                                        ...input,
                                      }
                                    : input2,
                                options2,
                              ),
                            onGesture: value134,
                            armWindowGestureEnd: callback30,
                            resolveImageSrc: value181,
                            snapLines: (): Dynamic => ({
                              lines: callback45({
                                notes: [source.id],
                              }),
                              threshold:
                                runtime.canvasTouchDragThresholdPixels /
                                camera.get().scale,
                            }),
                            onSnapGuides: value70,
                            vectorEdit: armedTool === "vector",
                            onEditPoints:
                              source.kind === "pen"
                                ? (): Dynamic => callback56(source.id)
                                : undefined,
                          } as const;
                          const _key2 = source.id;
                          return <_Component2 key={_key2} {..._props2} />;
                        })()
                      : (() => {
                          const _Component3 = runtime.CanvasNote;
                          const _props3 = {
                            spec: source,
                            editing: value18,
                            commenting: value126,
                            selected: selectedNotes.has(source.id),
                            grouped: value232,
                            objectPress: callback55(source),
                            onChange: (
                              input?: Dynamic,
                              options2?: Dynamic,
                            ): Dynamic =>
                              callback34(
                                source.id,
                                (input2?: Dynamic): Dynamic =>
                                  (0, runtime.isShapeAnnotation)(input2)
                                    ? input2
                                    : {
                                        ...input2,
                                        ...input,
                                      },
                                options2,
                              ),
                            onGesture: value134,
                            armWindowGestureEnd: callback30,
                            snapLines: (): Dynamic => ({
                              lines: callback45({
                                notes: [source.id],
                              }),
                              threshold:
                                runtime.canvasTouchDragThresholdPixels /
                                camera.get().scale,
                            }),
                            onSnapGuides: value70,
                            onTextEditing: (input?: Dynamic): Dynamic =>
                              value113(
                                (input2?: Dynamic): Dynamic =>
                                  input
                                    ? source.id
                                    : input2 === source.id
                                      ? null
                                      : input2,
                              ),
                            autoEdit:
                              source.text === "" && value59 === source.id,
                            onMeasure: (input?: Dynamic): Dynamic =>
                              value11(
                                (input2?: Dynamic): Dynamic =>
                                  input2[source.id]?.w === input.w &&
                                  input2[source.id]?.h === input.h
                                    ? input2
                                    : {
                                        ...input2,
                                        [source.id]: input,
                                      },
                              ),
                          } as const;
                          const _key3 = source.id;
                          return <_Component3 key={_key3} {..._props3} />;
                        })();
                    return {
                      under: callback6(source),
                      node: value35
                        ? (() => {
                            const _Component4 = "div";
                            const _props4 = {
                              ref: callback5,
                              className: "absolute left-0 top-0 h-0 w-0",
                              style: {
                                transformOrigin: "0 0",
                              },
                              children: value251,
                            } as const;
                            const _key4 = source.id;
                            return <_Component4 key={_key4} {..._props4} />;
                          })()
                        : value251,
                    };
                  },
                );
                return value35 ? (
                  <runtime.jsx_Nn.Fragment>
                    <runtime.ConditionalPortal on={true} to={value50}>
                      {value250
                        .filter((input?: Dynamic): Dynamic => input.under)
                        .map((input?: Dynamic): Dynamic => input.node)}
                    </runtime.ConditionalPortal>
                    <runtime.ConditionalPortal on={true} to={value46}>
                      {value250
                        .filter((input?: Dynamic): Dynamic => !input.under)
                        .map((input?: Dynamic): Dynamic => input.node)}
                    </runtime.ConditionalPortal>
                  </runtime.jsx_Nn.Fragment>
                ) : (
                  value250.map((input?: Dynamic): Dynamic => input.node)
                );
              })()}
            {artboardNotice &&
              fullscreenFile == null &&
              manifest.artboards.map((input?: Dynamic): Dynamic => {
                let value250: Dynamic = artboardNotice(input.file);
                return (
                  value250 != null &&
                  callback7(
                    "notice " + input.file,
                    (() => {
                      const _Component5 = runtime.ArtboardNoticeAnchor;
                      const _props5 = {
                        x: input.x,
                        y: input.y + input.h,
                        w: input.w,
                        inert: value126,
                        stamp: camera.stamp,
                        children: value250,
                      } as const;
                      const _key5 = input.file;
                      return <_Component5 key={_key5} {..._props5} />;
                    })(),
                  )
                );
              })}
            {value241 &&
              fullscreenFile == null &&
              callback7(
                "group-box",
                <div
                  data-mega-chrome={"group-resize"}
                  data-testid={value240 ? "mega-set-box" : "mega-group-box"}
                  className={"pointer-events-none absolute"}
                  style={{
                    left: value241.x,
                    top: value241.y,
                    width: value241.w,
                    height: value241.h,
                  }}
                >
                  <runtime.ViewportScale>
                    {(input?: Dynamic): Dynamic => (
                      <runtime.SelectionRing
                        frame={{
                          x: 0,
                          y: 0,
                          w: value241.w,
                          h: value241.h,
                        }}
                        scale={input}
                        rotation={
                          value242 ? (value242 * Math.PI) / 180 : undefined
                        }
                        angleLabel={
                          value233?.turning
                            ? String(value233.deg) + "\xB0"
                            : undefined
                        }
                        grips={value246 ? "none" : "corners"}
                        edgeStrips={!value243}
                        onResizeStart={callback59}
                        onRotateStart={
                          !value246 && value244 ? callback60 : undefined
                        }
                        rotateDisabledReason={value246 ? undefined : value245}
                      />
                    )}
                  </runtime.ViewportScale>
                </div>,
              )}
            {value114 &&
              value121?.kind === "image" &&
              ((): Dynamic => {
                let value250: Dynamic = callback27(value114) ?? value121;
                return callback7(
                  "crop",
                  <div
                    data-mega-chrome={"crop"}
                    data-testid={"mega-crop"}
                    className={"pointer-events-none absolute z-30"}
                    style={{
                      ...runtime.PickerRuntimeScriptTAppAccentConfig,
                      left: value250.x,
                      top: value250.y,
                      width: value250.w,
                      height: value250.h,
                      transform: value114.rot
                        ? "rotate(" + String(value114.rot) + "deg)"
                        : undefined,
                    }}
                  >
                    <div
                      className={"absolute"}
                      style={{
                        left: value114.edge.l,
                        top: value114.edge.t,
                        width: value114.local.w,
                        height: value114.local.h,
                      }}
                    >
                      <runtime.ViewportScale>
                        {(input?: Dynamic): Dynamic => (
                          <runtime.MediaCropEditor
                            frame={{
                              w: value114.local.w,
                              h: value114.local.h,
                            }}
                            natural={value114.natural}
                            crop={value114.live}
                            scale={input}
                            rotation={(value114.rot * Math.PI) / 180}
                            src={value181(value121.src)}
                            onLive={(input2?: Dynamic): Dynamic =>
                              value115(
                                (input3?: Dynamic): Dynamic =>
                                  input3 && {
                                    ...input3,
                                    live: input2,
                                  },
                              )
                            }
                            minFrame={runtime.PlatformFileContentConstant_20}
                            snapFrame={(input2?: Dynamic): Dynamic => {
                              let [items, items2, items3, items4]: Dynamic = [
                                Math.round(input2.x),
                                Math.round(input2.y),
                                Math.round(input2.x + input2.w),
                                Math.round(input2.y + input2.h),
                              ];
                              return {
                                x: items,
                                y: items2,
                                w: Math.max(
                                  runtime.PlatformFileContentConstant_20,
                                  items3 - items,
                                ),
                                h: Math.max(
                                  runtime.PlatformFileContentConstant_20,
                                  items4 - items2,
                                ),
                              };
                            }}
                            onFrame={(input2?: Dynamic): Dynamic =>
                              value115(
                                (input3?: Dynamic): Dynamic =>
                                  input3 && {
                                    ...input3,
                                    live: input2.crop,
                                    local: input2.frame,
                                  },
                              )
                            }
                            onDone={value120}
                            onGesture={(input2?: Dynamic): Dynamic => {
                              value134("crop", input2);
                              input2 && callback30("crop");
                            }}
                          />
                        )}
                      </runtime.ViewportScale>
                    </div>
                  </div>,
                );
              })()}
            {value75 && armedTool === "note" && (
              <div
                data-testid={"mega-note-ghost"}
                aria-hidden={"true"}
                className={
                  "pointer-events-none absolute z-30 rounded-[2px] border border-dashed border-black/25 opacity-70 shadow-md"
                }
                style={{
                  left: value75.x,
                  top: value75.y,
                  width: runtime.PlatformFileContentConstant_8,
                  height: (0, runtime.NotesLinkEditingLh)({
                    id: "",
                    x: 0,
                    y: 0,
                    w: 0,
                    text: "",
                  }),
                  background: "#fef3a2",
                }}
              />
            )}
            {value82 && (
              <div
                data-testid={"mega-pen-ghost"}
                className={"pointer-events-none contents"}
              >
                <runtime.CanvasShape
                  spec={{
                    id: "pen-ghost",
                    kind: "pen",
                    ...value82,
                  }}
                  scale={entry.scale}
                  editing={false}
                  selected={false}
                  objectPress={{}}
                  onChange={(): Dynamic => {}}
                  onGesture={(): Dynamic => {}}
                  armWindowGestureEnd={(): Dynamic => {}}
                />
              </div>
            )}
            {value80 && value80.onCanvas && value80.tool !== "text" && (
              <div
                data-testid={"mega-place-ghost"}
                className={"pointer-events-none contents"}
              >
                <runtime.CanvasShape
                  spec={(0, runtime.placementGhostAnnotation)(value80)}
                  scale={entry.scale}
                  editing={false}
                  selected={false}
                  objectPress={{}}
                  onChange={(): Dynamic => {}}
                  onGesture={(): Dynamic => {}}
                  armWindowGestureEnd={(): Dynamic => {}}
                />
              </div>
            )}
            {value80 && !(value80.onCanvas && value80.tool !== "text") && (
              <div
                data-testid={"mega-place-ghost"}
                className={(0, runtime.joinClassNames)(
                  "pointer-events-none absolute z-30",
                  !value247 &&
                    "border-solid border-app-accent/80 bg-app-accent/10",
                  value80.tool === "oval" && "rounded-full",
                )}
                style={{
                  ...runtime.PickerRuntimeScriptTAppAccentConfig,
                  borderWidth: value247 ? 0 : 1.5 / entry.scale,
                  left: value80.x,
                  top: value80.y,
                  width: Math.max(value80.w, value247 ? 8 : 0),
                  height: Math.max(value80.h, value247 ? 8 : 0),
                }}
              >
                {value247 && (
                  <svg
                    width={"100%"}
                    height={"100%"}
                    viewBox={
                      "0 0 " +
                      Math.max(value80.w, 8) +
                      " " +
                      Math.max(value80.h, 8)
                    }
                    style={{
                      display: "block",
                      overflow: "visible",
                    }}
                  >
                    <defs>
                      <marker
                        id={"mega-place-arrow-head"}
                        orient={"auto"}
                        markerWidth={"5"}
                        markerHeight={"5"}
                        refX={
                          runtime.SvgArrowsConstant -
                          runtime.SvgArrowsConstant_3
                        }
                        refY={runtime.SvgArrowsConstant_2}
                        overflow={"visible"}
                      >
                        <path
                          d={runtime.SvgArrowsCss}
                          stroke={"none"}
                          style={{
                            fill: "var(--t-app-accent)",
                          }}
                        />
                      </marker>
                    </defs>
                    <line
                      x1={value248?.x1}
                      y1={value248?.y1}
                      x2={value248?.x2}
                      y2={value248?.y2}
                      stroke={"var(--t-app-accent)"}
                      strokeWidth={4 / entry.scale}
                      strokeLinecap={"round"}
                      markerEnd={
                        value80.tool === "arrow"
                          ? "url(#mega-place-arrow-head)"
                          : undefined
                      }
                    />
                  </svg>
                )}
              </div>
            )}
            {value77 && (
              <div
                data-testid={"mega-draw-ghost"}
                className={
                  "pointer-events-none absolute z-30 rounded-sm border-2 border-dashed border-app-accent/70 bg-app-accent/5"
                }
                style={{
                  ...runtime.PickerRuntimeScriptTAppAccentConfig,
                  left: value77.x,
                  top: value77.y,
                  width: value77.w,
                  height: value77.h,
                }}
              />
            )}
            <runtime.PictureDropGhosts
              page={options.ghostPage ?? ""}
              artboards={
                value20
                  ? manifest.artboards.map(
                      (input?: Dynamic): Dynamic =>
                        input.file === value20.file ? value20 : input,
                    )
                  : manifest.artboards
              }
            />
            {options.pendingPictures != null &&
              options.pendingPictures.length > 0 &&
              callback7(
                "pending",
                options.pendingPictures.map(
                  (input?: Dynamic): Dynamic =>
                    (() => {
                      const _Component6 = "div";
                      const _props6 = {
                        "data-testid": "mega-picture-pending",
                        "data-mega-chrome": "picture-pending",
                        className: "pointer-events-none absolute z-30",
                        style: {
                          left: input.x,
                          top: input.y,
                          width: input.w,
                          height: input.h,
                        },
                        children: [
                          <img
                            aria-hidden={"true"}
                            src={input.url}
                            alt={""}
                            draggable={false}
                            className={"absolute inset-0 h-full w-full"}
                            style={{
                              objectFit: "fill",
                            }}
                          />,
                          <runtime.UploadingOverlay />,
                        ],
                      } as const;
                      const _key6 = input.key;
                      return <_Component6 key={_key6} {..._props6} />;
                    })(),
                ),
              )}
            {value73 != null &&
              value73.length > 0 &&
              callback7(
                "dup-ghosts",
                value73.map(
                  (input?: Dynamic, options2?: Dynamic): Dynamic => (
                    <div
                      key={options2}
                      data-testid={"mega-dup-ghost"}
                      className={
                        "pointer-events-none absolute z-30 rounded-sm border-2 border-dashed border-app-accent/70 bg-app-accent/5"
                      }
                      style={{
                        ...runtime.PickerRuntimeScriptTAppAccentConfig,
                        left: input.x,
                        top: input.y,
                        width: input.w,
                        height: input.h,
                      }}
                    />
                  ),
                ),
              )}
            {options.worldOverlay}
          </div>
          {value35 && (
            <div
              ref={value51}
              data-mega-lifted={"under"}
              aria-busy={options.turnBusy ? true : undefined}
              className={"absolute left-0 top-0 h-0 w-0"}
            />
          )}
          {value35 && (
            <div
              ref={value37}
              data-mega-lifted={"tiles"}
              aria-busy={options.turnBusy ? true : undefined}
              className={"absolute left-0 top-0 h-0 w-0"}
            />
          )}
          {value35 && (
            <div
              ref={value47}
              data-mega-lifted={"notes"}
              aria-busy={options.turnBusy ? true : undefined}
              className={"absolute left-0 top-0 h-0 w-0"}
            />
          )}
          {value35 && (
            <div
              ref={value54}
              data-mega-lifted={"chrome"}
              className={"absolute left-0 top-0 h-0 w-0"}
            />
          )}
          {value86 && (
            <div
              ref={value90}
              data-testid={"mega-marquee"}
              aria-hidden={"true"}
              className={
                "pointer-events-none absolute z-30 bg-accent-muted outline-1 -outline-offset-1 outline-fill-accent"
              }
            />
          )}
          {value69 && fullscreenFile == null && (
            <runtime.CanvasSnapGuides guides={value69} />
          )}
          {value71 && fullscreenFile == null && (
            <runtime.CanvasGapGuides gaps={value71} />
          )}
          {dragToast && (
            <div
              data-mega-chrome={"drag-toast"}
              data-testid={"mega-drag-toast"}
              className={
                "pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border bg-page px-3 py-1.5 text-xs shadow-lg"
              }
            >
              {dragToast}
            </div>
          )}
          {dragGhost && value249 && (
            <div
              data-mega-chrome={"drag-ghost"}
              data-testid={"mega-drag-ghost"}
              data-ghost={dragGhost.alt ? "copy" : "move"}
              aria-label={(dragGhost.alt ? "Copy " : "Move ") + dragGhost.label}
              className={"pointer-events-none absolute z-40"}
              style={{
                ...runtime.PickerRuntimeScriptTAppAccentConfig,
                left: value249.left,
                top: value249.top,
                width: value249.width,
                height: value249.height,
              }}
            >
              <div
                className={
                  "absolute inset-0 overflow-hidden rounded-sm border border-dashed border-app-accent/70"
                }
              >
                {dragGhost.ghost != null &&
                  (() => {
                    const _Component7 = runtime.PlacementGhostFrame;
                    const _props7 = {
                      ghost: dragGhost.ghost,
                      style: {
                        width: value249.box.w,
                        height: value249.box.h,
                        transform: `scale(${value249.s})`,
                        transformOrigin: "0 0",
                      },
                    } as const;
                    const _key7 = dragGhost.key;
                    return <_Component7 key={_key7} {..._props7} />;
                  })()}
              </div>
              {dragGhost.alt && (
                <span
                  data-testid={"mega-drag-ghost-copy"}
                  className={
                    "absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-app-accent text-[11px] font-semibold leading-none text-white shadow-md"
                  }
                >
                  {"+"}
                </span>
              )}
            </div>
          )}
          {dragGhost && !value249 && (
            <div
              data-mega-chrome={"drag-ghost"}
              data-testid={"mega-drag-ghost"}
              className={
                "pointer-events-none absolute z-40 rounded-md border border-app-accent bg-page/90 px-2 py-1 text-xs shadow-md"
              }
              style={{
                ...runtime.PickerRuntimeScriptTAppAccentConfig,
                left: (dragGhost.x - entry.x) * entry.scale + 8,
                top: (dragGhost.y - entry.y) * entry.scale + 8,
              }}
            >
              {dragGhost.alt ? "Copy " : "Move "}
              {dragGhost.label}
            </div>
          )}
          {value129 && fullscreenFile == null ? (
            <div
              data-mega-pan-blanket={""}
              data-testid={"mega-pan-overlay"}
              className={
                "absolute inset-0 z-[35] cursor-grab active:cursor-grabbing"
              }
            />
          ) : null}
          {value18 &&
            !value124 &&
            fullscreenFile == null &&
            value59 != null &&
            !(0, runtime.supportsClickPlacement)(armedTool) &&
            armedTool !== "draw" &&
            ((): Dynamic => {
              let value250: Dynamic = (manifest.annotations ?? []).find(
                (input?: Dynamic): Dynamic => input.id === value59,
              );
              if (!value250) return null;
              let value251: Dynamic = value112 === value250.id;
              if (value251 && value250.kind === "title1") return null;
              let value252: Dynamic = (0, runtime.rotatedAnnotationBounds)(
                  value250,
                  callback44(value250),
                ),
                callback61: Dynamic = (input?: Dynamic): Dynamic =>
                  callback34(
                    value250.id,
                    (input2?: Dynamic): Dynamic =>
                      (0, runtime.isShapeAnnotation)(input2)
                        ? input2
                        : (0, runtime.updateAnnotationTextStyle)(input2, input),
                    true,
                  );
              return (
                <runtime.CanvasAnchoredPopover
                  x={value252.x + value252.w / 2}
                  y={value252.y}
                  belowSheet={value15 === "sheet"}
                >
                  {(input?: Dynamic): Dynamic => (
                    <runtime.SessionStrip
                      data-testid={"mega-note-strip"}
                      data-mega-selection-strip={""}
                      aria-label={
                        (0, runtime.isShapeAnnotation)(value250)
                          ? "Shape actions"
                          : "Note actions"
                      }
                      surface={"popover"}
                      wrap={value17}
                      onKeyDown={runtime.handleQuickActionsArrowKeys}
                    >
                      {(0, runtime.isShapeAnnotation)(value250)
                        ? (() => {
                            const _Component8 =
                              runtime.CanvasObjectQuickActions;
                            const _props8 = {
                              spec: value250,
                              onRecolor: (input2?: Dynamic): Dynamic =>
                                callback34(
                                  value250.id,
                                  (input3?: Dynamic): Dynamic =>
                                    (0, runtime.isShapeAnnotation)(input3)
                                      ? (0, runtime.updateShapeColor)(
                                          input3,
                                          input2,
                                        )
                                      : input3,
                                  true,
                                ),
                              onDelete: (): Dynamic =>
                                onDeleteAnnotation?.(value250.id),
                              onComment:
                                value8 &&
                                ((input2?: Dynamic): Dynamic =>
                                  value8(value250.id, input2)),
                              cropping: value114?.id === value250.id,
                              onCrop:
                                value250.kind === "image"
                                  ? (): Dynamic =>
                                      value114
                                        ? value120(true)
                                        : callback28(value250.id)
                                  : undefined,
                              cropReason:
                                value250.kind !== "image" || value114
                                  ? undefined
                                  : callback25(value250.id)
                                    ? (0, runtime.imageFlipCss)(value250)
                                      ? runtime.CropDoesNotWorkWhileThisMessage
                                      : undefined
                                    : "This picture has not loaded, so there is nothing to crop yet.",
                              clip:
                                value250.kind === "image" &&
                                value250.video !== undefined &&
                                onAnnotationCss &&
                                onReplaceAnnotationMedia
                                  ? {
                                      src: value181(value250.src) ?? undefined,
                                      onCss: (
                                        input2?: Dynamic,
                                        options2?: Dynamic,
                                      ): Dynamic =>
                                        onAnnotationCss(
                                          value250.id,
                                          input2,
                                          options2,
                                        ),
                                      onReplace: (input2?: Dynamic): Dynamic =>
                                        onReplaceAnnotationMedia(
                                          value250.id,
                                          input2,
                                        ),
                                      onOpenProps:
                                        value21 && !value18
                                          ? undefined
                                          : (): Dynamic => {
                                              onOpenPropsPanel?.();
                                              value162();
                                            },
                                    }
                                  : undefined,
                            } as const;
                            const _key8 =
                              value250.id +
                              "@" +
                              [input, value252.x, value252.y, value252.w].join(
                                ",",
                              );
                            return <_Component8 key={_key8} {..._props8} />;
                          })()
                        : value251
                          ? (() => {
                              const _Component9 =
                                runtime.EditingNoteQuickActions;
                              const _props9 = {
                                spec: value250,
                                onRestyle: callback61,
                                onComment:
                                  value8 &&
                                  ((input2?: Dynamic): Dynamic =>
                                    value8(value250.id, input2)),
                              } as const;
                              const _key9 =
                                value250.id +
                                "@" +
                                [
                                  input,
                                  value250.x,
                                  value250.y,
                                  value250.w,
                                ].join(",");
                              return <_Component9 key={_key9} {..._props9} />;
                            })()
                          : (() => {
                              const _Component0 = runtime.NoteQuickActions;
                              const _props0 = {
                                spec: value250,
                                onRestyle: callback61,
                                onDelete: (): Dynamic =>
                                  onDeleteAnnotation?.(value250.id),
                                onComment:
                                  value8 &&
                                  ((input2?: Dynamic): Dynamic =>
                                    value8(value250.id, input2)),
                              } as const;
                              const _key0 =
                                value250.id +
                                "@" +
                                [
                                  input,
                                  value250.x,
                                  value250.y,
                                  value250.w,
                                ].join(",");
                              return <_Component0 key={_key0} {..._props0} />;
                            })()}
                    </runtime.SessionStrip>
                  )}
                </runtime.CanvasAnchoredPopover>
              );
            })()}
          <runtime.useCanvasComments
            manifest={manifest}
            annBox={callback44}
            annUnder={callback6}
            pageKey={pageKey}
            camera={camera}
            surfaceRef={value9}
            handlesRef={value2}
            fullscreenFile={fullscreenFile ?? null}
            fullscreenFrame={value20}
            onReveal={onRevealComment}
            onController={(input?: Dynamic): Dynamic => {
              value5(input);
              onCommentsController?.(input);
            }}
            onModeChange={(input?: Dynamic): Dynamic => {
              value127(input);
              onCommenting?.(input);
              input && onClearSelection();
            }}
            armedTool={armedTool}
            spaceHeld={value95}
            keyHeld={
              value124 || value136 || streamDragFile != null || value140 != null
            }
          />
          {value18 &&
            (!elementMenuHidden || crossFile != null) &&
            !value124 &&
            !value136 &&
            streamDragFile == null &&
            elementSelection &&
            elementSelection.count > 0 &&
            elementSelection.rect &&
            (0, runtime.hasSelectionQuickActions)({
              text: quickProps?.text ?? 0,
              shape: quickProps?.shape ?? 0,
              box: quickProps?.box ?? 0,
              image: quickProps?.image ?? 0,
              other: quickProps?.other ?? 0,
              line: quickProps?.line ?? 0,
              crossFile: crossFile != null,
              sidebarVisible: false,
              textEdit: value140,
              editDoor: quickProps?.onEditText != null,
              commentDoor: value7 != null,
            }) &&
            ((): Dynamic => {
              let value250: Dynamic = manifest.artboards.find(
                (input?: Dynamic): Dynamic =>
                  input.file === elementSelection.file,
              );
              if (!value250) return null;
              let rect: Dynamic = elementSelection.rect,
                value251: Dynamic = Math.max(
                  0,
                  Math.min(value250.w, rect.x + rect.w / 2),
                ),
                value252: Dynamic = Math.max(0, Math.min(value250.h, rect.y)),
                value253: Dynamic =
                  value250.file === fullscreenFile &&
                  fullscreenBox &&
                  flag &&
                  tweakRows?.[value250.file]
                    ? runtime.artboardTweaksRowHeight
                    : 0;
              return (
                <runtime.CanvasAnchoredPopover
                  x={value250.x + value251}
                  y={value250.y + value252}
                  dy={value253}
                  belowSheet={value15 === "sheet"}
                >
                  {(input?: Dynamic): Dynamic => (
                    <runtime.SessionStrip
                      data-mega-selection-strip={""}
                      aria-label={"Selection actions"}
                      surface={"popover"}
                      wrap={value17}
                      onKeyDown={runtime.handleQuickActionsArrowKeys}
                    >
                      {(() => {
                        const _Component1 =
                          runtime.PositionedSelectionQuickActions;
                        const _props1 = {
                          at: input,
                          text: quickProps?.text ?? 0,
                          shape: quickProps?.shape ?? 0,
                          box: quickProps?.box ?? 0,
                          image: quickProps?.image ?? 0,
                          other: quickProps?.other ?? 0,
                          line: quickProps?.line ?? 0,
                          primaryTag: quickProps?.primaryTag ?? "",
                          part: elementSelection.part,
                          seed: seed,
                          onEditText: quickProps?.onEditText ? value166 : null,
                          crossFile: crossFile ?? null,
                          sidebarVisible: false,
                          onOpenProps: value162,
                          onApply: value163,
                          onGesture: value164,
                          textEdit: value140,
                          onReplaceImage: quickProps?.onReplaceImage
                            ? value167
                            : undefined,
                          onCrop: quickProps?.onCrop ? value168 : undefined,
                          cropping: quickProps?.cropping,
                          cropReason: quickProps?.cropReason,
                          onReplaceVideo: quickProps?.onReplaceVideo
                            ? value169
                            : undefined,
                          findVideo: quickProps?.findVideo
                            ? value170
                            : undefined,
                          onElementLink: quickProps?.onElementLink
                            ? value171
                            : undefined,
                          contrastRef: quickProps?.contrastRef,
                          coarse: value16,
                          compact: value17,
                          onFormat: value165,
                          onComment: value7 ? value172 : undefined,
                        } as const;
                        const _key1 = elementSelection.identity;
                        return <_Component1 key={_key1} {..._props1} />;
                      })()}
                    </runtime.SessionStrip>
                  )}
                </runtime.CanvasAnchoredPopover>
              );
            })()}
        </div>
      </runtime.ViewportContext.Provider>
    );
  }
  bindRuntimeValue(
    runtime,
    "toggleArtboardDragCurtain",
    () => toggleArtboardDragCurtain,
  );
  bindRuntimeValue(
    runtime,
    "canvasDragSequence",
    () => canvasDragSequence,
    (value) => {
      canvasDragSequence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasInteractionLayer",
    () => CanvasInteractionLayer,
  );
  return () => {
    canvasDragSequence = 0;
  };
}
