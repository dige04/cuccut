/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasArtboardFrame(
  runtime: RuntimeBindings,
): () => void {
  var ArtboardFrame: Dynamic;
  function ArtboardSelectionChrome({
    slot: slot,
    live: live,
    interactive: interactive,
    onGripDown: onGripDown,
    onContextMenu: onContextMenu,
    sinkRef: sinkRef,
    crop: crop,
    onPenPreview: onPenPreview,
    onPenCommit: onPenCommit,
    onPenGesture: onPenGesture,
    vectorEdit: vectorEdit,
    board: board,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, runtime.reactCanvasShape.useState)(null);
    sinkRef.current = value2;
    let value3: Dynamic = (0, runtime.useViewportScale)(live && value !== null),
      value4: Dynamic = (0, runtime.useViewportMinScale)(
        runtime.selectionChromeMinimumScale,
      ),
      value5: Dynamic = crop !== null && !(interactive && value4);
    (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
      value5 && crop?.onDone(true);
    }, [value5, crop]);
    (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
      live || value2(null);
    }, [live]);
    return !slot ||
      !live ||
      !value ||
      (value.rings.length === 0 &&
        !value.stroke &&
        !value.measure &&
        !value.guides &&
        !value.artboard &&
        !value.pen)
      ? null
      : (0, runtime.reactDomCanvasShape.createPortal)(
          <runtime.jsx_ip.Fragment>
            <runtime.SelectionChromeOverlay
              chrome={value}
              scale={value3}
              interactive={interactive && value4}
              onGripDown={onGripDown}
              onContextMenu={onContextMenu}
              crop={interactive && value4 ? crop : null}
              board={board}
            />
            {value.pen && vectorEdit && interactive && value4 && (
              <div
                className={"pointer-events-none absolute left-0 top-0"}
                style={{
                  ...runtime.PickerRuntimeScriptTAppAccentConfig,
                  transform: `scale(${String(1 / value3)})`,
                  transformOrigin: "0 0",
                }}
              >
                {(() => {
                  const _Component = runtime.ElementPenEditor;
                  const _props = {
                    pen: value.pen,
                    scale: value3,
                    onPreview: onPenPreview,
                    onCommitStroke: onPenCommit,
                    onGesture: onPenGesture,
                  } as const;
                  const _key = value.pen.tid;
                  return <_Component key={_key} {..._props} />;
                })()}
              </div>
            )}
          </runtime.jsx_ip.Fragment>,
          slot,
        );
  }
  bindRuntimeValue(
    runtime,
    "ArtboardSelectionChrome",
    () => ArtboardSelectionChrome,
  );
  bindRuntimeValue(
    runtime,
    "ArtboardFrame",
    () => ArtboardFrame,
    (value) => {
      ArtboardFrame = value;
    },
  );
  return () => {
    ArtboardFrame = (0, runtime.reactCanvasShape.memo)(function (
      input?: Dynamic,
    ): Dynamic {
      let { showToast: value }: Dynamic = (0, runtime.useToast)(),
        {
          vectorEdit: value69 = false,
          file: value2,
          displayTitle: value3,
          title: value4,
          live: value70 = true,
          expanded: value71 = false,
          onPagePointer: value5,
          onPageScroll: value6,
          playing: value72 = false,
          migrated: value73 = false,
          frameless: value74 = false,
          onContentHull: value7,
          box: value8,
          boxRowH: value75 = 0,
          component: value76 = false,
          chromeSlot: value77 = null,
          onHostGesture: value9,
          onTweaksRow: value10,
          onTweaksDirty: value11,
          onOpenTweaks: value12,
          canvasScaleRef: value13,
          assets: value14,
          doc: value15,
          editing: value78 = false,
          routeForwardedKey: value16,
          onDragEvent: value17,
          onModifierKey: value18,
          onBoxEvent: value19,
          onPanZoom: value20,
          onRepeatRefused: value21,
          pointerInert: value79 = false,
          keyboardInert: value80 = false,
          inertFrame: value81 = false,
          onPreviewClick: value22,
          panelMounted: value23,
          gripless: value82 = false,
          readOnly: value83 = false,
          frameArmed: value24,
          editable: value25,
          onHandle: value26,
          onPreviewDropNotice: value27,
          onReadyGen: value28,
          dsVarNames: value29,
          onDefinedVars: value30,
          onBlockedChange: value31,
          onProblemsChange: value32,
          exitGuardRef: value33,
          textEditOpenRef: value34,
          settleSessionRef: value35,
          commitOpenTextEditRef: value36,
          onSessionDirtyChange: value37,
          onEditInput: value38,
          onLocalEdit: value39,
          onUndoStack: value40,
          onToolChange: value41,
          toolResetTick: value42,
          onOpenFile: value43,
          onPasteImages: value44,
          onDropVideos: value45,
          onPointerPresence: value46,
          onPointerAt: value47,
          onHistoryPush: value48,
          onModelReparsed: value49,
          onHistoryApply: value50,
          onHistoryRevoke: value51,
          onHistoryDrop: value52,
          onTweakEdit: value53,
          sessionEpoch: value54,
          actionsRef: value55,
          onSelection: value56,
          onSelectionSeq: value57,
          onGestureStream: value58,
          onTextEditState: value59,
          onTextEditEnded: value60,
          keyboardSkipsContent: value61,
          artboardSettings: value62,
          canvasObject: value63,
          outlineArtboards: value64,
          presentPropsTick: value65,
          onPresentPropsHandled: value66,
          placeRequest: value67,
          onPlaceHandled: value68,
        }: Dynamic = input,
        flag: Dynamic = false,
        value84: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value85: Dynamic = (0, runtime.reactCanvasShape.useMemo)(
          (): Dynamic => new runtime.PreviewGenerationGate(),
          [],
        ),
        [value86, value87]: Dynamic = (0, runtime.reactCanvasShape.useState)(
          null,
        ),
        value88: Dynamic = value86?.srcdoc ?? null,
        value89: Dynamic = (0, runtime.reactCanvasShape.useRef)(-1),
        value90: Dynamic = (0, runtime.reactCanvasShape.useRef)(-1),
        [value91, value92]: Dynamic = (0, runtime.reactCanvasShape.useState)(0),
        [value93, value94]: Dynamic = (0, runtime.reactCanvasShape.useState)(0),
        [value95, value96]: Dynamic = (0, runtime.reactCanvasShape.useState)(
          null,
        ),
        [value97, value98]: Dynamic = (0, runtime.reactCanvasShape.useState)(
          null,
        ),
        [value99, value100]: Dynamic = (0, runtime.reactCanvasShape.useState)(
          runtime.emptyArtboardErrors,
        ),
        value101: Dynamic = (0, runtime.reactCanvasShape.useRef)(-1),
        value102: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value103: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value104: Dynamic = (0, runtime.reactCanvasShape.useRef)(0),
        value105: Dynamic = (0, runtime.reactCanvasShape.useRef)({
          why: "",
          at: 0,
        }),
        [value106, value107]: Dynamic = (0, runtime.reactCanvasShape.useState)(
          false,
        ),
        value108: Dynamic = (0, runtime.reactCanvasShape.useRef)(false);
      value108.current = value106;
      let value109: Dynamic = (0, runtime.reactCanvasShape.useRef)(null);
      value109.current = value88;
      let value110: Dynamic = (0, runtime.reactCanvasShape.useRef)(value86);
      value110.current = value86;
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic => {},
        [value88],
      );
      let value111: Dynamic = (0, runtime.reactCanvasShape.useRef)(-1),
        value112: Dynamic = (0, runtime.reactCanvasShape.useRef)(-1),
        value113: Dynamic = (0, runtime.reactCanvasShape.useRef)(value93);
      value113.current = value93;
      let value114: Dynamic = (0, runtime.reactCanvasShape.useRef)(value70);
      value114.current = value70;
      let value115: Dynamic = (0, runtime.reactCanvasShape.useRef)(new Set()),
        value116: Dynamic = (0, runtime.reactCanvasShape.useRef)(new Set()),
        value117: Dynamic = (0, runtime.reactCanvasShape.useRef)(new Set()),
        value118: Dynamic = (0, runtime.reactCanvasShape.useRef)(0),
        value119: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value120: Dynamic = (0, runtime.reactCanvasShape.useRef)(new Set()),
        value121: Dynamic = (0, runtime.reactCanvasShape.useRef)(new Set()),
        value122: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value123: Dynamic = (0, runtime.reactCanvasShape.useRef)(0),
        value124: Dynamic = (0, runtime.reactCanvasShape.useRef)(null);
      value124.current = value95;
      let value125: Dynamic = (0, runtime.reactCanvasShape.useRef)(null);
      value125.current = value97;
      let [value126, value127]: Dynamic = (0,
        runtime.reactCanvasShape.useState)(false),
        value128: Dynamic = value88 != null,
        value129: Dynamic = value95 != null || value97 != null;
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (!(!value70 || !value24 || !value128 || value126 || value129))
          return runtime.artboardBootScheduler.request(
            value2,
            (): Dynamic =>
              value114.current
                ? value127(true)
                : runtime.artboardBootScheduler.done(value2),
          );
      }, [value70, value24, value128, value126, value129, value2]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value106 && runtime.artboardBootScheduler.done(value2);
      }, [value106, value2]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        (value95 == null && value97 == null) ||
          (runtime.artboardBootScheduler.done(value2), value127(false));
      }, [value95, value97, value2]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic =>
          runtime.artboardBootScheduler.done(value2),
        [value2],
      );
      let value130: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            value84.current = input2;
            input2 != null &&
              ((0, runtime.setPreviewGenerationGate)(input2, value85),
              value85.generationMounted(value93));
          },
          [value85, value93],
        ),
        value131: Dynamic = (0, runtime.reactCanvasShape.useRef)({}),
        value132: Dynamic = (0, runtime.reactCanvasShape.useRef)(0),
        value133: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value134: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          value123.current = value85.mountedGeneration;
          value85.frameRetired();
          value87(null);
          value107(false);
        }, [value85]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => value134,
        [value134],
      );
      let [value135, value136]: Dynamic = (0,
        runtime.reactCanvasShape.useState)(false),
        value137: Dynamic = value25 && !value135,
        value138: Dynamic = (0, runtime.reactCanvasShape.useRef)(0),
        value139: Dynamic = (0, runtime.reactCanvasShape.useRef)(new Map()),
        value140: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
          value139.current.clear();
          let callback5: Dynamic = (): Dynamic =>
            value85.blocked == null &&
            value124.current == null &&
            value125.current == null &&
            value131.current.holdFrame?.("rebuild") === true;
          if (callback5()) return;
          let value286: Dynamic = ++value138.current,
            callback6: Dynamic = (): Dynamic => value286 !== value138.current;
          try {
            let value287: Dynamic = await (0, runtime.getKvClient)().list(
                runtime.FileValue,
              ),
              state2: Dynamic = {
                ...(0, runtime.getDesignSystemFiles)(),
              };
            for (let value297 of value287 as Dynamic) {
              let value298: Dynamic = await (0, runtime.getKvClient)().get(
                value297,
              );
              value298 != null &&
                (state2[value297.slice(runtime.FileValue.length)] = value298);
            }
            (0, runtime.registerImageFileUrls)(state2);
            value136((0, runtime.isLoadingArtboardHtml)(state2[value2] ?? ""));
            try {
              await value133.current?.(value2);
            } catch {
            } finally {
              value139.current.clear();
            }
            let callback7: Dynamic = (): Dynamic =>
              value114.current
                ? false
                : (value134(),
                  value96(null),
                  value98(null),
                  value100(runtime.emptyArtboardErrors),
                  true);
            if (callback6() || callback7() || callback5()) return;
            let value288: Dynamic = null,
              value289: Dynamic = (0, runtime.artboardsAtAddressEnabled)(),
              value290: Dynamic = (0, runtime.PreviewBuildDocumentStringify)({
                partMin: (0, runtime.effectiveDesignPartMinScale)(),
                frameless: value74,
                assets: value14,
                installed: (0, runtime.designSystemCacheKey)(),
                address: (0, runtime.addressedArtboardCacheKey)(value289),
              }),
              value291: Dynamic = (0, runtime.getCachedArtboardCompilation)(
                value2,
                state2,
                value290,
              );
            if (value291 === null) {
              let value297: Dynamic = (0,
                runtime.collectProjectDependencyFiles)(state2, value2),
                value298: Dynamic = (0, runtime.resolveAddressedArtboard)(
                  value297,
                  value2,
                  value289,
                ),
                value299: Dynamic =
                  value298 === undefined || "copied" in value298
                    ? undefined
                    : value298;
              value289 &&
                value298 !== undefined &&
                (0, runtime.notifyUndoGesture)("board-address", {
                  file: value2,
                  how:
                    "copied" in value298
                      ? "the /appifact/ base"
                      : "the published base",
                  ...("copied" in value298
                    ? {
                        why: value298.copied,
                      }
                    : {}),
                });
              let value300: Dynamic = (0, runtime.normalizeProjectBlobPaths)(
                  value299?.files ?? value297,
                ),
                values: Dynamic = new Set(),
                {
                  doc: value301,
                  parts: value302,
                  sheetUrls: value303,
                  byAddress: value304,
                }: Dynamic = (0, runtime.buildPreviewDocument)(
                  value300,
                  value2,
                  value14,
                  values,
                  value299 !== undefined
                    ? {
                        frameless: value74,
                        atAddress: {
                          projectRoot: value299.projectPath,
                          base: value299.pageUrl,
                        },
                      }
                    : {
                        partMin: (0, runtime.effectiveDesignPartMinScale)(),
                        frameless: value74,
                        sheetUrlFor: (0,
                        runtime.createProjectAssetReadinessProbe)(state2),
                        installedUrlFor:
                          runtime.resolvePublishedDesignSystemFile,
                        fileUrlFor: runtime.createLinkedFileScript,
                      },
                );
              value291 = {
                names: (0, runtime.projectFileNamesKey)(state2),
                opts: value290,
                closure: value297,
                doc: value301,
                parts: value302,
                sheetUrls: value303 ?? {},
                byAddress: value304,
                rootSheets: values,
                ...(value299 !== undefined
                  ? {
                      at: value299,
                    }
                  : {}),
              };
              (0, runtime.cacheArtboardCompilation)(value2, value291);
            }
            let {
              doc: value292,
              parts: value293,
              closure: value294,
              rootSheets: value295,
              sheetUrls: value296,
            }: Dynamic = value291;
            value291.at !== undefined
              ? value87({
                  srcdoc: value292,
                  projectRoot: value291.at.projectRoot,
                })
              : value87(
                  Object.keys(value293).length > 0
                    ? {
                        srcdoc: runtime.PreviewBuildDocumentResolvedValue_3,
                        boot: {
                          doc: value292,
                          parts: (0, runtime.runtimeModuleBlobs)(value293),
                          urls: {
                            ...(0, runtime.runtimeModuleUrls)(value293),
                            ...value296,
                          },
                        },
                      }
                    : {
                        srcdoc: value292,
                      },
                );
            value144.current = state2[value2];
            value115.current = new Set(
              Object.keys(value291.at?.files ?? value294),
            );
            value116.current = new Set(Object.keys(value294));
            value120.current = new Set(value295);
            value121.current = new Set(Object.values(value291.byAddress));
            value94(value85.hostWillLoad());
            value96(null);
            value98(null);
          } catch (value287: Dynamic) {
            value98(String(value287));
            (0, runtime.unblockDesignFramesReady)();
          }
        }, [value2, value85, value134, value74]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic =>
          (0, runtime.subscribeArtboardsAtAddressFlag)((): Dynamic => {
            value140();
          }),
        [value140],
      );
      let value141: Dynamic = (0, runtime.reactCanvasShape.useRef)([]),
        value142: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (): Dynamic => false,
          [value140],
        );
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value140();
        let value286: Dynamic = (0, runtime.subscribeDesignSystemFiles)(
            (): Dynamic => {
              value140();
            },
          ),
          value287: Dynamic = (0, runtime.subscribeHtmlReferences)(
            (input2?: Dynamic): Dynamic => {
              input2.some(
                (input3?: Dynamic): Dynamic =>
                  (0, runtime.isRequiredProjectFile)(
                    input3,
                    value2,
                    value116.current,
                    value115.current,
                  ),
              ) && value140();
            },
          );
        return (): Dynamic => {
          value286();
          value287();
        };
      }, [value140]);
      let value143: Dynamic = (0, runtime.reactCanvasShape.useRef)(value70);
      (0, runtime.reactCanvasShape.useLayoutEffect)((): Dynamic => {
        if (value70 !== value143.current) {
          value143.current = value70;
          if (!value70) {
            value109.current != null &&
              value124.current == null &&
              value125.current == null &&
              (runtime.lastDesignEditAt = performance.now());
            value134();
            value127(false);
            runtime.artboardBootScheduler.done(value2);
            return;
          }
          value124.current != null || value125.current != null || value140();
        }
      }, [value70, value140, value134]);
      let value144: Dynamic = (0, runtime.reactCanvasShape.useRef)(undefined),
        value145: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
          let value286: Dynamic = value15.content().files[value2],
            current: Dynamic = value144.current;
          if (value286 !== undefined && value286 === current) return null;
          if (
            !(0, runtime.createPreviewHandle)(value84.current) ||
            value124.current != null ||
            value125.current != null
          )
            return "the frame is not live";
          let value287: Dynamic = (0, runtime.compareDesignSourceScripts)(
            current,
            value286,
          );
          if (!value287.ok) return value287.why;
          let value288: Dynamic = (0, runtime.artboardComponentName)(value2);
          try {
            await value133.current?.(value2);
          } catch {}
          let value289: Dynamic = value159.current.state(value288),
            value290: Dynamic =
              value289 && value289.path === value2 ? value289 : null;
          if (
            value290 &&
            (value290.dirty ||
              value290.pendingScript !== undefined ||
              value290.pendingProps !== undefined)
          )
            return "this board has unsaved local edits";
          if (value290 && value290.src === value286) {
            value290.stampGen = (value290.stampGen ?? -1) + 1;
            value290.liveStampsStale = false;
            value159.current.pushLive(value288);
          } else {
            if (value290)
              return "the model did not adopt the new bytes (its own guards refused)";
            (0, runtime.emitEditorEvent)("dc-update", {
              name: value288,
              path: value2,
              kind: "html",
              content: value287.template,
              streaming: false,
              viewportKey: "dc-model",
            });
            value49?.(value2, null, null);
          }
          value144.current = value286;
          return null;
        }, [value2]),
        value146: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            (0, runtime.notifyUndoGesture)("board-remote", {
              file: value2,
              how:
                "the text box or drag ended: " +
                (input2 === "rebuild" ? "reloading now" : "redrawing now"),
            });
            input2 === "rebuild"
              ? value140()
              : value159.current.pushLive(
                  (0, runtime.artboardComponentName)(value2),
                );
          },
          [value140, value2],
        );
      (0, runtime.npm_useEventListener_bc)(
        runtime.forceRefreshEventName,
        (): Dynamic => {
          value140();
        },
      );
      (0, runtime.npm_useEventListener_bc)(
        runtime.remoteFilesEventName,
        (input2?: Dynamic): Dynamic => {
          let value286: Dynamic = input2.detail?.paths ?? [],
            value287: Dynamic = (0, runtime.filterAddressedFiles)(
              value286,
              value2,
              value116.current,
              value115.current,
              (): Dynamic =>
                (0, runtime.collectProjectDependencyFiles)(
                  (0, runtime.mergeDesignSystemFileOverlay)(
                    value15.content().files,
                  ),
                  value2,
                ),
            );
          if (value287.length !== 0) {
            if (
              value287.length === 1 &&
              value287[0] === value2 &&
              (0, runtime.editorOwnsUndo)()
            ) {
              let value288: Dynamic = performance.now();
              value145().then(
                (input3?: Dynamic): Dynamic => {
                  input3 === null
                    ? (0, runtime.notifyUndoGesture)("board-remote", {
                        file: value2,
                        how: "in place (__dcUpdate)",
                        ms: Math.round(performance.now() - value288),
                      })
                    : ((0, runtime.notifyUndoGesture)("board-remote", {
                        file: value2,
                        how: "rebuilt iframe",
                        why: input3,
                      }),
                      value140());
                },
                (input3?: Dynamic): Dynamic => {
                  (0, runtime.notifyUndoGesture)("board-remote", {
                    file: value2,
                    how: "rebuilt iframe",
                    why: "in-place threw: " + String(input3),
                  });
                  value140();
                },
              );
              return;
            }
            (0, runtime.notifyUndoGesture)("board-remote", {
              file: value2,
              how: "rebuilt iframe",
              why:
                value287.length === 1 && value287[0] === value2
                  ? "in-place is off"
                  : "a file this board imports changed: " + value287.join(", "),
            });
            value140();
          }
        },
      );
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic =>
          (0, runtime.scheduleDesktopRenderingRefresh)(
            (): Dynamic => value84.current,
          ),
        [value91],
      );
      let value147: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value148: Dynamic = (0, runtime.useDcProps)({
          webviewRef: value84,
          readyGen: value91,
          projectPath: "appifact",
          filePath: value2,
          enabled: true,
          onWritten: (input2?: Dynamic, options?: Dynamic): Dynamic =>
            value147.current?.(
              (0, runtime.artboardComponentName)(input2),
              options,
            ),
        });
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value10?.(value2, value148.hasProps);
      }, [value2, value148.hasProps, value10]);
      let value149: Dynamic = (0,
      runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
        await value148.saveAsDefaults();
        try {
          await value133.current?.(value2);
        } catch {}
      }, [value2, value148.saveAsDefaults]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value11?.(value2, value137 && value148.dirty ? value149 : null);
      }, [
        value2,
        value137,
        value148.dirty,
        value148.values,
        value149,
        value11,
      ]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic => value11?.(value2, null),
        [value2, value11],
      );
      let value150: Dynamic = (0, runtime.reactCanvasShape.useRef)(value59);
      value150.current = value59;
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value23 || value150.current?.(value2, null);
      }, [value23, value2]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value150.current?.(value2, null);
      }, [value93, value2]);
      (0, runtime.npm_useEventListener_bc)(
        "message",
        (dataset?: Dynamic): Dynamic => {
          let data: Dynamic = dataset.data;
          if (data?.__om_hello === 1) {
            let value286: Dynamic = value84.current?.contentWindow;
            if (
              value286 != null &&
              dataset.source === value286 &&
              dataset.origin === (0, runtime.currentHttpOrigin)()
            ) {
              let value287: Dynamic = dataset.ports[0];
              value287 != null && value85.helloReceived(value287);
            }
            return;
          }
          if (data?.__om_nav_away === 1) {
            if (dataset.origin !== (0, runtime.currentHttpOrigin)()) return;
            let mountedGeneration: Dynamic = value85.mountedGeneration,
              helloPort: Dynamic = value85.helloPort;
            if (helloPort == null) return;
            let value286: Dynamic =
              performance.now() - runtime.lastDesignEditAt <
              runtime.designEditQuietPeriodMs
                ? runtime.navigationProbeAttemptsAfterEdit
                : runtime.navigationProbeAttempts;
            (0, runtime.probePreviewRuntime)(helloPort, {
              attempts: value286,
            }).then((input2?: Dynamic): Dynamic => {
              mountedGeneration <= value123.current ||
                (value85.verdict(mountedGeneration, input2),
                value85.blocked != null &&
                  !value142() &&
                  (value96(value85.blocked),
                  (0, runtime.unblockDesignFramesReady)()));
            });
            return;
          }
        },
      );
      (0, runtime.npm_useEventListener_bc)(
        "message",
        (dataset?: Dynamic): Dynamic => {
          if (!(0, runtime.isPreviewMessage)(dataset, value84.current)) return;
          let data: Dynamic = dataset.data;
          if (data != null && typeof data == "object" && "__om_link" in data) {
            (0, runtime.openPreviewExternalLink)(data.__om_link);
            return;
          }
          if (
            data != null &&
            typeof data == "object" &&
            "__dc_boot_failed" in data
          ) {
            if (
              value90.current === value113.current ||
              (value110.current?.boot != null &&
                value89.current !== value113.current) ||
              (data.e === runtime.TheArtboardRuntimeDidNotLoadMessage &&
                dataset.source !== null &&
                value119.current === dataset.source)
            )
              return;
            if (
              data.e === runtime.TheArtboardRuntimeDidNotLoadMessage &&
              value118.current < 2
            ) {
              value118.current++;
              value119.current = dataset.source;
              (0, runtime.markRuntimeUrlBlocked)(data.u);
              console.warn(
                "[design] artboard " +
                  value2 +
                  " could not load its runtime by URL; rebuilding without that URL",
              );
              value140();
              return;
            }
            console.warn(
              "[design] artboard " +
                value2 +
                " did not boot: " +
                String(data.e).slice(0, 200),
            );
            value98("its content didn't load. Reload to try again");
            (0, runtime.unblockDesignFramesReady)();
            return;
          }
          if (
            data != null &&
            typeof data == "object" &&
            runtime.DcAddressRefusedValue in data
          ) {
            let u: Dynamic = data.u,
              current: Dynamic = value110.current;
            if (current?.projectRoot !== undefined) {
              if (value122.current === current.srcdoc) return;
              let value296: Dynamic = (0, runtime.lookupPublishedUrl)(
                  current.projectRoot,
                  u,
                ),
                value297: Dynamic = (0, runtime.invalidatePublishedRoot)(
                  current.projectRoot,
                  u,
                );
              if (value297 === undefined || value296 === undefined) return;
              value122.current = current.srcdoc;
              (0, runtime.notifyUndoGesture)("board-address", {
                file: value2,
                how: "built again after a failed load",
                why: "a published file did not load: " + value296,
              });
              value297 === "first" &&
                console.warn(
                  "[design] Could not load " +
                    value296 +
                    ((0, runtime.getCurrentPublishedProjectRoot)() === undefined
                      ? " from where this canvas is published. Artboards are drawn from the editor's own copy of the files instead."
                      : " from an older saved version. The artboard is drawn again from the version this page shows now.") +
                    " Your files are not changed.",
                );
              value140();
              return;
            }
            let value295: Dynamic = (0, runtime.invalidateDesignSystemUrl)(
              value121.current,
              u,
            );
            value295 === "first" &&
              console.warn(
                "[design] a design system file did not load from " +
                  String(u) +
                  ". Artboards that use that design system are shown from the page's own copy; fonts its stylesheets name by relative path will not load until the page is reloaded or shows another version.",
              );
            value295 !== undefined && value140();
            return;
          }
          if (data?.type === "__dc_render_errors") {
            let value295: Dynamic = (0, runtime.normalizeArtboardErrorMessages)(
              data.errors,
            );
            value100(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.reuseEqualStringArray)(input2, value295),
            );
            return;
          }
          if (data?.__dcEditorEvt?.type === "__dc_preview_drop_notice") {
            if (!value137) return;
            value27(value2, data.__dcEditorEvt.video === true);
            return;
          }
          if (data?.__dcEditorEvt?.type === "previewClick") {
            if (value23 || !value22) return;
            let __dcEditorEvt: Dynamic = data.__dcEditorEvt;
            value22(
              value2,
              __dcEditorEvt.shift === true || __dcEditorEvt.meta === true,
            );
            return;
          }
          if (
            data?.type === "__dc_booted" &&
            typeof data.rootName == "string"
          ) {
            runtime.artboardBootScheduler.done(value2);
            value101.current = value113.current;
            data.tellsErrors !== true && value100(runtime.emptyArtboardErrors);
            data.mounted === true &&
              data.rootName !== (0, runtime.artboardComponentName)(value2) &&
              value112.current !== value113.current &&
              ((value112.current = value113.current),
              console.error(
                "[design] artboard " +
                  value2 +
                  ' booted as "' +
                  data.rootName.slice(0, 80) +
                  '", host pushes to "' +
                  (0, runtime.artboardComponentName)(value2) +
                  '" \u2014 live edits will not render',
              ));
            value148.lifecycleCallbacks.onDcBooted({
              rootName: data.rootName,
              propsMeta: data.propsMeta ?? null,
            });
            value111.current !== value113.current &&
              ((value111.current = value113.current),
              value170(value169)?.dirty && value159.current.pushLive(value169));
            return;
          }
          let value286: Dynamic = data?.__dcEditorEvt;
          if (value286?.type === "modifierKey") {
            if (
              !value23 ||
              value83 ||
              !value18 ||
              value286.key !== "deep" ||
              typeof value286.on != "boolean"
            )
              return;
            value18(value2, "deep", value286.on, value286.blur === true);
            return;
          }
          let value287: Dynamic = data?.__dcEditorEvt;
          if (
            value287 &&
            (value287.type === "boxLive" ||
              value287.type === "boxEnd" ||
              value287.type === "boxCancel" ||
              value287.type === "canvasPointerDown")
          ) {
            if (
              value23 &&
              !value83 &&
              value19 &&
              typeof value287.gestureKey == "string" &&
              /^[0-9a-f]{16}$/.test(value287.gestureKey)
            ) {
              let value295: Dynamic =
                value287.type === "canvasPointerDown"
                  ? "press"
                  : value287.type === "boxLive"
                    ? "live"
                    : value287.type === "boxEnd"
                      ? "end"
                      : "cancel";
              value19(value2, {
                type: value295,
                key: value287.gestureKey,
              });
            }
            if (value287.type !== "canvasPointerDown") return;
          }
          let value288: Dynamic = data?.__dcEditorEvt;
          if (
            value288 &&
            typeof value288.type == "string" &&
            value288.type.startsWith("drag") &&
            value17
          ) {
            if (!value23 || value83) return;
            let value295: Dynamic = value288,
              value296: Dynamic =
                typeof value295.gestureKey == "string" &&
                /^[0-9a-f]{16}$/.test(value295.gestureKey)
                  ? value295.gestureKey
                  : null;
            if (!value296) return;
            let callback5: Dynamic = (input2?: Dynamic): Dynamic =>
                typeof input2 == "number" &&
                Number.isFinite(input2) &&
                Math.abs(input2) < 1e6
                  ? input2
                  : null,
              callback6: Dynamic = (): Dynamic =>
                Array.isArray(value295.tids)
                  ? value295.tids
                      .filter(
                        (input2?: Dynamic): Dynamic =>
                          typeof input2 == "number" &&
                          Number.isInteger(input2) &&
                          input2 >= 0 &&
                          input2 < 1e6,
                      )
                      .slice(0, 16)
                  : [],
              callback7: Dynamic = (): Dynamic => {
                let value297: Dynamic = callback5(value295.w),
                  value298: Dynamic = callback5(value295.h);
                if (
                  value297 == null ||
                  value298 == null ||
                  value297 < 1 ||
                  value298 < 1
                )
                  return null;
                let callback8: Dynamic = (input2?: Dynamic): Dynamic =>
                    Math.round(Math.min(input2, 8e3)),
                  value299: Dynamic = callback5(value295.ew),
                  value300: Dynamic = callback5(value295.eh),
                  callback9: Dynamic = (input2?: Dynamic): Dynamic =>
                    Math.round(
                      Math.max(-8e3, Math.min(8e3, callback5(input2) ?? 0)),
                    );
                return {
                  w: callback8(value297),
                  h: callback8(value298),
                  ew:
                    value299 != null && value299 >= 1
                      ? callback8(value299)
                      : callback8(value297),
                  eh:
                    value300 != null && value300 >= 1
                      ? callback8(value300)
                      : callback8(value298),
                  ox: callback9(value295.ox),
                  oy: callback9(value295.oy),
                  gx: Math.round(
                    Math.min(
                      value297,
                      8e3,
                      Math.max(0, callback5(value295.gx) ?? value297 / 2),
                    ),
                  ),
                  gy: Math.round(
                    Math.min(
                      value298,
                      8e3,
                      Math.max(0, callback5(value295.gy) ?? value298 / 2),
                    ),
                  ),
                };
              };
            if (value295.type === "dragExit") {
              let value297: Dynamic = callback6();
              if (value297.length === 0) return;
              value17(value2, {
                type: "exit",
                key: value296,
                tids: value297,
                alt: value295.alt === true,
                box: callback7(),
              });
            } else if (value295.type === "dragState") {
              if (value295.live === true) {
                let value297: Dynamic = callback6();
                value17(value2, {
                  type: "arm",
                  key: value296,
                  tids: value297.length > 0 ? value297 : null,
                  alt: value295.alt === true,
                  box: callback7(),
                });
              } else
                value17(value2, {
                  type: "disarm",
                  key: value296,
                });
            } else if (value295.type === "dragMove") {
              let value297: Dynamic = callback5(value295.x),
                value298: Dynamic = callback5(value295.y);
              if (value297 == null || value298 == null) return;
              value17(value2, {
                type: "move",
                key: value296,
                x: value297,
                y: value298,
                alt: value295.alt === true,
                ctrl: value295.ctrl === true,
              });
            } else if (value295.type === "dragDrop") {
              let value297: Dynamic = callback5(value295.x),
                value298: Dynamic = callback5(value295.y);
              if (value297 == null || value298 == null) return;
              value17(value2, {
                type: "drop",
                key: value296,
                x: value297,
                y: value298,
                alt: value295.alt === true,
                ctrl: value295.ctrl === true,
              });
            } else
              (value295.type === "dragCancel" ||
                value295.type === "dragReturn") &&
                value17(value2, {
                  type: "cancel",
                  key: value296,
                });
            return;
          }
          let value289: Dynamic = data?.__dcEditorEvt;
          if (value289 && value289.type === "panZoom") {
            if (!value20) return;
            let value295: Dynamic = value289,
              callback5: Dynamic = (input2?: Dynamic): Dynamic =>
                typeof input2 == "number" && Number.isFinite(input2)
                  ? input2
                  : null,
              value296: Dynamic = callback5(value295.dx),
              value297: Dynamic = callback5(value295.dy),
              value298: Dynamic = callback5(value295.x),
              value299: Dynamic = callback5(value295.y),
              value300: Dynamic = callback5(value295.dz) ?? 0;
            if (
              value296 == null ||
              value297 == null ||
              value298 == null ||
              value299 == null
            )
              return;
            let callback6: Dynamic = (
              input2?: Dynamic,
              options?: Dynamic,
              context?: Dynamic,
            ): Dynamic => Math.max(options, Math.min(context, input2));
            value20(value2, {
              pinch: value295.pinch === true,
              touch: value295.touch === true,
              dx: callback6(value296, -1e3, 1e3),
              dy: callback6(value297, -1e3, 1e3),
              dz: callback6(value300, -0.25, 0.25),
              x: callback6(value298, 0, 1e5),
              y: callback6(value299, 0, 1e5),
            });
            return;
          }
          if (value289 && value289.type === "panHold") {
            let value295: Dynamic = value289.on === true;
            (!value295 || value23) &&
              (0, runtime.suppressNativeContextMenu)(value295);
            return;
          }
          let value290: Dynamic = data?.__dcEditorEvt;
          if (value290 && value290.type === "repeatRefused") {
            if (!value21 || !value23 || value83) return;
            let count: Dynamic = value290.count,
              reason: Dynamic = value290.reason;
            if (
              typeof count != "number" ||
              !Number.isFinite(count) ||
              count < 1 ||
              count > 1e4 ||
              (reason !== "self" && reason !== "siblings")
            )
              return;
            value21(value2, Math.floor(count), reason);
            return;
          }
          let value291: Dynamic = data?.__dcEditorEvt;
          if (value291 && value291.type === "textEditState" && value59) {
            if (!value23 || value83) return;
            let value295: Dynamic = value291;
            if (value295.active !== true) {
              value59(value2, null);
              return;
            }
            value39?.(value2);
            if (value295.plain === true)
              value59(value2, {
                formats: null,
              });
            else {
              let formats: Dynamic = value295.formats,
                callback5: Dynamic = (input2?: Dynamic): Dynamic =>
                  input2 === true;
              value59(value2, {
                formats: {
                  bold: callback5(formats?.bold),
                  italic: callback5(formats?.italic),
                  underline: callback5(formats?.underline),
                  ul: callback5(formats?.ul),
                  ol: callback5(formats?.ol),
                  link: callback5(formats?.link),
                },
              });
            }
            return;
          }
          let value292: Dynamic = data?.__dcEditorEvt;
          value292 &&
            value292.type === "chrome" &&
            value8 &&
            (value23 || (value137 && value78)) &&
            (0, runtime.updateDropGhostDemand)(
              value2,
              (0, runtime.parseSelectionChromePayload)(
                value292,
                value8,
              ).rings.reduce(
                (input2?: Dynamic, options?: Dynamic): Dynamic =>
                  input2 + +(options.k === "busy"),
                0,
              ),
            );
          if (value292 && value292.type === "chrome") {
            if (!value8 || !(value23 || (value137 && value78))) return;
            let value295: Dynamic = (0, runtime.parseSelectionChromePayload)(
                value292,
                value8,
                {
                  gripless: value168.current,
                  cropTid: value198.current?.tid,
                },
              ),
              value296: Dynamic = value295.rings.find(
                (input2?: Dynamic): Dynamic =>
                  input2.media !== undefined || input2.cropOff !== undefined,
              );
            value103.current = value296?.media ? value296 : null;
            let value297: Dynamic =
              value296?.media !== undefined &&
              !(0, runtime.MediaObjectCropSupports)() &&
              !!value159.current
                .state(value169)
                ?.model.inlineStyleValue(value296.media.tid, "object-view-box");
            (0, runtime.updateElementSessionState)(value2, {
              target: value296?.media
                ? value297
                  ? {
                      off: "foreign-zoom",
                    }
                  : {
                      tid: value296.media.tid,
                    }
                : value296?.cropOff
                  ? {
                      off: value296.cropOff,
                    }
                  : null,
            });
            value198.current &&
              (!value211.current() ||
                value296?.media?.tid !== value198.current.tid) &&
              value212.current(true);
            value102.current?.(value295);
            return;
          }
          if (value292 && value292.type === "cropRequest") {
            let tid: Dynamic = value292.tid,
              value295: Dynamic =
                navigator.userActivation === undefined ||
                navigator.userActivation.isActive;
            if (
              !value23 ||
              value198.current ||
              !value295 ||
              !Number.isSafeInteger(tid) ||
              (0, runtime.SessionElementStateGet)(value2).selected !== tid ||
              Date.now() - value104.current < 500
            )
              return;
            value104.current = Date.now();
            let target: Dynamic = (0, runtime.SessionElementStateGet)(
              value2,
            ).target;
            if (target !== null && "tid" in target && target.tid === tid)
              value213.current(tid, true);
            else if (value208.current) {
              let value296: Dynamic =
                target !== null && "off" in target
                  ? runtime.SessionElementStateUnloadedTurnedAutoConfig[
                      target.off
                    ]
                  : runtime.CropIsNotAvailableHereForMessage;
              (value105.current.why !== value296 ||
                Date.now() - value105.current.at > 5e3) &&
                value(value296);
              value105.current = {
                why: value296,
                at: Date.now(),
              };
            }
            return;
          }
          if (value292 && value292.type === "contentHull") {
            if (!value74) return;
            if (value292.empty === true) value7?.(value2, null);
            else {
              let value295: Dynamic = (0,
              runtime.normalizeArtboardMeasuredSize)(value292);
              value295 && value7?.(value2, value295);
            }
            return;
          }
          let value293: Dynamic = data?.__dcEditorEvt;
          value293 &&
            value58 &&
            value23 &&
            !value83 &&
            (value293.type === "stylePreview" || value293.type === "movePreview"
              ? value58(value2, true)
              : (value293.type === "move" ||
                  value293.type === "resize" ||
                  value293.type === "rotate" ||
                  value293.type === "groupTransform" ||
                  value293.type === "styleRevert" ||
                  value293.type === "movePreviewCancel") &&
                value58(value2, false));
          let value294: Dynamic = data?.__dcEditorEvt;
          if (value294?.type === "select" && value56) {
            typeof value294.s == "number" &&
              Number.isSafeInteger(value294.s) &&
              value294.s >= 0 &&
              value57?.(value2, value294.s);
            let callback5: Dynamic = (input2?: Dynamic): Dynamic =>
                typeof input2 == "number" &&
                Number.isFinite(input2) &&
                Math.abs(input2) < 1e6
                  ? input2
                  : null,
              rect: Dynamic = value294.rect,
              value295: Dynamic = callback5(rect?.x),
              value296: Dynamic = callback5(rect?.y),
              value297: Dynamic = callback5(rect?.w),
              value298: Dynamic = callback5(rect?.h);
            if (!value23) return;
            let value299: Dynamic = Array.isArray(value294.tids)
              ? value294.tids
                  .filter(
                    (input2?: Dynamic): Dynamic =>
                      typeof input2 == "number" &&
                      Number.isInteger(input2) &&
                      input2 >= 0 &&
                      input2 < 1e6,
                  )
                  .slice(0, 512)
              : null;
            if (
              value294.name != null &&
              (typeof value294.name != "string" ||
                !(0, runtime.isEditableComponentName)(value294.name) ||
                value294.name !== (0, runtime.artboardComponentName)(value2))
            )
              return;
            let value300: Dynamic =
              typeof value294.name == "string" ? value294.name : null;
            value56(value2, {
              tids: value299,
              name: value300,
              tag: typeof value294.tag == "string" ? value294.tag : undefined,
              part: value294.part === "text" ? "text" : undefined,
              rect:
                value295 != null &&
                value296 != null &&
                value297 != null &&
                value298 != null
                  ? {
                      x: value295,
                      y: value296,
                      w: value297,
                      h: value298,
                    }
                  : null,
              re:
                typeof value294.re == "string" &&
                /^[A-Za-z0-9:._-]{1,32}$/.test(value294.re)
                  ? value294.re
                  : undefined,
              additive: value294.additive === true,
              s:
                typeof value294.s == "number" &&
                Number.isSafeInteger(value294.s) &&
                value294.s >= 0
                  ? value294.s
                  : undefined,
              artboard: value294.artboard === true && value299 == null,
            });
          }
        },
      );
      let [value151, value152]: Dynamic = (0,
        runtime.reactCanvasShape.useState)(0),
        value153: Dynamic = (0, runtime.reactCanvasShape.useRef)(null);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic => {
          value153.current && clearTimeout(value153.current);
        },
        [],
      );
      (0, runtime.npm_useEventListener_bc)(
        "dc-update",
        (input2?: Dynamic): Dynamic => {
          let detail: Dynamic = input2.detail;
          if (!(0, runtime.createPreviewHandle)(value84.current)) return;
          let value286: Dynamic = (0, runtime.mergeDesignSystemFileOverlay)(
              value15.content().files,
            ),
            value287: Dynamic = (0, runtime.resolveComponentFile)(value286, {
              ...detail,
              kind: "html",
            });
          if (
            value287 !== undefined &&
            value287 !== value2 &&
            !value115.current.has(value287) &&
            !value117.current.has(value287)
          )
            return;
          let value288: Dynamic = value287 ?? value2,
            value289: Dynamic = value110.current?.projectRoot,
            flag2: Dynamic = false;
          if (value289 !== undefined && detail.kind === "html") {
            let value296: Dynamic = (0, runtime.addressedArtboardFailure)(
              {
                ...value286,
                [value288]: detail.content,
              },
              value2,
              value289,
            );
            flag2 = value296 === undefined;
            value296 !== undefined &&
              (0, runtime.notifyUndoGesture)("board-address", {
                file: value2,
                how: "a push prepared by copying files in",
                why: value296,
              });
          }
          let value290: Dynamic = flag2
              ? (0, runtime.selectPageFiles)(value286)
              : value286,
            value291: Dynamic =
              value287 === value2 && detail.kind === "html"
                ? new Set()
                : undefined,
            value292: Dynamic = value291
              ? {
                  inlined: value291,
                }
              : {
                  covered: value120.current,
                },
            value293: Dynamic =
              detail.kind === "html"
                ? (0, runtime.rewritePreviewAssets)(
                    detail.content,
                    value290,
                    value288,
                    value292,
                  )
                : (0, runtime.rewriteProjectAssets)(
                    detail.content,
                    value290,
                    (0, runtime.PreviewAssetRewritingSlice)(value288),
                  );
          value291 && (value120.current = value291);
          let current: Dynamic = value115.current,
            value294: Dynamic = (0, runtime.componentRuntimeDependencies)(
              value290,
              value2,
              current,
              detail,
              value120.current,
            ),
            value295: Dynamic = Object.keys(value294);
          ((input3?: Dynamic, options?: Dynamic): Dynamic => {
            let value296: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            if (!value296) return;
            let value297: Dynamic = `${value295.length > 0 ? `window.__dcFiles=Object.assign(window.__dcFiles||{},${JSON.stringify(options)});` : ""}${(0, runtime.updateComponentRuntimeScript)(value2, detail, input3)}${detail.kind === "html" ? runtime.PickerBridgeLabel : ""}`;
            value291 &&
              !detail.streaming &&
              (value153.current && clearTimeout(value153.current),
              (value153.current = setTimeout(
                (): Dynamic =>
                  value152((input4?: Dynamic): Dynamic => input4 + 1),
                400,
              )));
            if (value295.length === 0) {
              value296.executeJavaScriptUnchecked(value297);
              return;
            }
            for (let value298 of value295 as Dynamic)
              value117.current.add(value298);
            value296.executeJavaScript(value297 + ";void 0").then(
              (): Dynamic =>
                value295.forEach((input4?: Dynamic): Dynamic => {
                  current.add(input4);
                  value117.current.delete(input4);
                }),
              (): Dynamic => {},
            );
          })(
            (0, runtime.normalizeBlobAssetPaths)(value293),
            (0, runtime.normalizeProjectBlobPaths)(value294),
          );
        },
      );
      let value154: Dynamic = "loadState" in value15,
        value155: Dynamic = (0, runtime.reactCanvasShape.useContext)(
          runtime.CanvasWorkingStateContext,
        ),
        value156: Dynamic = (0, runtime.reactCanvasShape.useRef)(
          value155?.peekEpoch(value2),
        ),
        callback: Dynamic = (
          input2?: Dynamic,
          options?: Dynamic,
          context?: Dynamic,
        ): Dynamic =>
          (0, runtime.adoptModelAndRelocateSelection)({
            adopt: context,
            own: (): Dynamic => {
              let value286: Dynamic = value159.current.state(input2);
              return input2 === (0, runtime.artboardComponentName)(value2) &&
                value286?.path === value2
                ? value286.model
                : undefined;
            },
            prev: options,
            heldElsewhere: (): Dynamic => {
              let value286: Dynamic = value131.current.heldComponent?.();
              return value286 != null && value286 !== input2;
            },
            pending: {
              drop: (): Dynamic => {
                value139.current.delete(input2);
              },
              arm: (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                value139.current.set(input2, {
                  then: input3,
                  stillValid: options2,
                });
              },
            },
            tellHost: (input3?: Dynamic, options2?: Dynamic): Dynamic =>
              value49?.(value2, input3, options2),
            log: (input3?: Dynamic, options2?: Dynamic): Dynamic =>
              console.error(
                "[artboard] adopting an outside edit: " + input3 + ":",
                options2,
              ),
          }),
        value157: Dynamic = (0, runtime.useDcModel)("appifact", value2, {
          enabled: true,
          historyKeeper: value155 ?? undefined,
          get historyEpoch(): Dynamic {
            return value156.current;
          },
          sessionHeld: value23,
          get liveStore(): Dynamic {
            return value154 || false;
          },
          onAdopted: (input2?: Dynamic, options?: Dynamic): Dynamic => {},
          onLocalEdit: (): Dynamic => {
            value132.current += 1;
            value39?.(value2);
          },
          holdPush: (input2?: Dynamic): Dynamic =>
            input2 === (0, runtime.artboardComponentName)(value2) &&
            value131.current.holdFrame?.("push") === true,
          onPushLive: (input2?: Dynamic): Dynamic => {
            value132.current += 1;
            value131.current.onPushLive?.(input2);
            let entry: Dynamic = value139.current.get(input2);
            value139.current.delete(input2);
            entry?.then(
              (): Dynamic =>
                entry.stillValid(value159.current.state(input2)?.model),
            );
          },
          onBeforeMutate: (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
          ): Dynamic => {
            value48?.(value2);
            value286 && value139.current.delete(input2);
            value131.current.onBeforeMutate?.(
              input2,
              options,
              context,
              value286,
            );
          },
          onExternalReparse: (input2?: Dynamic, options?: Dynamic): Dynamic => {
            value132.current += 1;
            callback(
              input2,
              options,
              (): Dynamic =>
                value131.current.onExternalReparse?.(input2, options),
            );
          },
          onPendingPropsDropped: (
            input2?: Dynamic,
            options?: Dynamic,
          ): Dynamic =>
            value131.current.onPendingPropsDropped?.(input2, options),
          onPendingPropsSettled: (
            input2?: Dynamic,
            options?: Dynamic,
          ): Dynamic =>
            value131.current.onPendingPropsSettled?.(input2, options),
          writes: {
            onSavedAdopted: (input2?: Dynamic, options?: Dynamic): Dynamic => {
              value132.current += 1;
              callback(
                input2,
                value159.current.state(input2)?.model ?? null,
                (): Dynamic =>
                  value131.current.onSavedAdopted?.(input2, options),
              );
            },
            onWriteError: (input2?: Dynamic): Dynamic => {
              value131.current.onWriteError
                ? value131.current.onWriteError(input2)
                : value(
                    (0, runtime.fileCapFailureMessage)(input2) ??
                      "Couldn't save edits in " +
                        value2 +
                        " \u2014 focus that artboard to retry.",
                    "error",
                  );
            },
            onWriteConflict: (
              input2?: Dynamic,
              options?: Dynamic,
              context?: Dynamic,
              value286?: Dynamic,
            ): Dynamic => {
              value(
                "Save conflicted with another change \u2014 reloaded.",
                "error",
              );
            },
            onWriteReverted: (input2?: Dynamic, options?: Dynamic): Dynamic =>
              value(
                (0, runtime.fileCapFailureMessage)(options) ??
                  "Couldn't save that change \u2014 reverted.",
                "error",
              ),
            awaitWriteClearance: async (): Promise<Dynamic> => {},
          },
        });
      value133.current = value157.adoptExternal;
      value147.current = value157.noteOwnWrite;
      let { installGen: value158 }: Dynamic = (0,
      runtime.useArtboardRuntimeInstallation)(
        value84,
        value91,
        value23,
        true,
        false,
        false,
        value83,
      );
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (value158 === 0) return;
        let value286: Dynamic = (0, runtime.createPreviewHandle)(
          value84.current,
        );
        if (value286) {
          (0, runtime.setPickerInteractive)(
            value286,
            value71 ? "scroll" : value72 ? "play" : true,
          );
          let value287: Dynamic = value13?.current;
          value287 !== undefined &&
            value287 !== 1 &&
            (0, runtime.setPickerHostScale)(value286, value287);
        }
      }, [value158, value13, value71, value72]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (!value71 || value91 === 0 || (!value5 && !value6)) return;
        let value286: Dynamic = value84.current?.contentWindow;
        if (value286)
          return (
            (0, runtime.observePageScrollAndPointer)(
              value286,
              (input2?: Dynamic, options?: Dynamic): Dynamic =>
                value5?.(value2, input2, options),
              (input2?: Dynamic, options?: Dynamic): Dynamic =>
                value6?.(value2, input2, options),
            ) ?? undefined
          );
      }, [value71, value91, value2, value5, value6]);
      let value159: Dynamic = (0, runtime.reactCanvasShape.useRef)(value157);
      value159.current = value157;
      let value160: Dynamic = (0, runtime.reactCanvasShape.useRef)(value148);
      value160.current = value148;
      let value161: Dynamic = (0, runtime.reactCanvasShape.useRef)(value53);
      value161.current = value53;
      let value162: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic): Dynamic => {
            let current: Dynamic = value160.current,
              value286: Dynamic = (0, runtime.getPropCurrentValue)(
                current,
                input2,
              ),
              value287: Dynamic =
                options === undefined
                  ? current.propsMeta[input2]?.default
                  : options;
            (0, runtime.equalPropValues)(value286, value287) ||
              value161.current?.(
                value2,
                {
                  [input2]: value286,
                },
                {
                  [input2]: value287,
                },
              );
            current.setProp(
              input2,
              (0, runtime.overridePropDefault)(current, input2, options),
            );
          },
          [value2],
        ),
        value163: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let current: Dynamic = value160.current,
            state2: Dynamic = {},
            state3: Dynamic = {};
          for (let value286 of Object.keys(current.values) as Dynamic)
            value286 in current.propsMeta &&
              ((state2[value286] = current.values[value286]),
              (state3[value286] = current.propsMeta[value286]?.default));
          Object.keys(state2).length > 0 &&
            value161.current?.(value2, state2, state3, false);
          current.reset();
        }, [value2]),
        state: Dynamic = {
          ...value148,
          setProp: value162,
          reset: value163,
          autoSavesDefaults: value154,
        },
        value164: Dynamic = (0, runtime.reactCanvasShape.useRef)(value52);
      value164.current = value52;
      let value165: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => value164.current?.(value2, input2),
          [value2],
        ),
        value166: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let current: Dynamic = value160.current;
            for (let [value286, value287] of Object.entries(input2) as Dynamic)
              current.setProp(
                value286,
                (0, runtime.overridePropDefault)(current, value286, value287),
              );
          },
          [],
        ),
        value167: Dynamic = (0, runtime.reactCanvasShape.useRef)(value23),
        value168: Dynamic = (0, runtime.reactCanvasShape.useRef)(value82);
      value168.current = value82;
      value167.current = value23;
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        !(value23 || (value137 && value78)) ||
          value54 === undefined ||
          (value156.current !== value54 &&
            ((value156.current = value54),
            (0, runtime.resetModelBaselines)(value159.current)));
      }, [value23, value137, value78, value54]);
      let value169: Dynamic = (0, runtime.reactCanvasShape.useMemo)(
          (): Dynamic => (0, runtime.artboardComponentName)(value2),
          [value2],
        ),
        value170: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            if (input2 !== value169) return null;
            let value286: Dynamic = value159.current.state(input2);
            return value286 && value286.path === value2 ? value286 : null;
          },
          [value169, value2],
        ),
        value171: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(input2);
            return !value286 || !value286.model.element(options)
              ? null
              : value286.model.attributes(options);
          },
          [value170],
        ),
        value172: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.getTextListKind)(
              value170(value169)?.model.element(input2),
            ),
          [value170, value169],
        ),
        value173: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            input2 === value169 && value159.current.ensureModel(input2);
          },
          [value169],
        ),
        value174: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value175: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let current: Dynamic = value174.current;
          if (current) return current;
          let value286: Dynamic = value159.current
            .ensureModel(value169)
            .then(
              (input2?: Dynamic): Dynamic =>
                input2 ? input2.model.outline() : null,
            )
            .finally((): Dynamic => {
              value174.current === value286 && (value174.current = null);
            });
          value174.current = value286;
          return value286;
        }, [value169]),
        value176: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(input2);
            return !value286 || !value286.model.element(options)
              ? null
              : (value286.model.inlineStyleValue(options, context) ?? null);
          },
          [value170],
        ),
        value177: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(value169);
            if (!value286) return null;
            let value287: Dynamic = (0, runtime.copySelectedElementsHtml)(
              value286.model,
              input2,
            );
            value287 != null &&
              options?.lift &&
              (value287 = (0, runtime.flattenSelectionTemplates)(
                value286.model,
                input2,
                (0, runtime.positionPastedHtml)(value287, options.lift),
              ));
            if (value287 == null || !options?.bakeProps) return value287;
            let state2: Dynamic = {};
            try {
              let value291: Dynamic = JSON.parse(
                (0, runtime.getDcPropsJson)(value286.src) ?? "{}",
              );
              value291 &&
                typeof value291 == "object" &&
                !Array.isArray(value291) &&
                (state2 = value291);
            } catch {
              state2 = {};
            }
            let values: Dynamic = value160.current.values,
              value288: Dynamic = value286.pendingProps ?? {},
              value289: Dynamic = options?.vals,
              value290: Dynamic = (0, runtime.getLoopTemplateVariables)(
                value287,
              );
            return (0, runtime.flattenTemplateValues)(
              value287,
              (input3?: Dynamic): Dynamic => {
                if (
                  input3.startsWith("$") ||
                  runtime.ClipboardTemplateFlatteningTrueFalseNullSet.has(
                    input3,
                  )
                )
                  return;
                if (!Object.hasOwn(state2, input3))
                  return value289 &&
                    !value290.has(input3) &&
                    Object.hasOwn(value289, input3)
                    ? value289[input3]
                    : undefined;
                if (Object.hasOwn(values, input3)) return values[input3];
                if (Object.hasOwn(value288, input3)) return value288[input3];
                let value291: Dynamic = state2[input3];
                return value291 && typeof value291 == "object"
                  ? value291.default
                  : undefined;
              },
            );
          },
          [value170, value169],
        ),
        value178: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = await value159.current.mutate(
              value169,
              (input3?: Dynamic, options?: Dynamic): Dynamic =>
                options.path !== value2
                  ? false
                  : (0, runtime.deleteModelElements)(options, input2) > 0,
              {
                structural: true,
              },
            );
            return value286 === "applied" || value286 === "applied-dirty";
          },
          [value169, value2],
        ),
        value179: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = await value159.current.mutate(
              value169,
              (input3?: Dynamic, options?: Dynamic): Dynamic => {
                if (
                  options.path !== value2 ||
                  (0, runtime.containsUneditableSelection)(options.model, [
                    ...input2,
                  ])
                )
                  return false;
                let value287: Dynamic = (0, runtime.selectedRootElementIds)(
                  options.model,
                  [...input2],
                ).filter(
                  (input4?: Dynamic): Dynamic =>
                    options.model.element(input4) != null &&
                    !options.model.isUneditable(input4),
                );
                if (value287.length === 0) return false;
                let flag2: Dynamic = false;
                for (let value288 of value287 as Dynamic)
                  options.model.duplicateElement(value288) && (flag2 = true);
                flag2 && options.model.restamp();
                return flag2;
              },
              {
                structural: true,
              },
            );
            return value286 === "applied" || value286 === "applied-dirty";
          },
          [value169, value2],
        ),
        value180: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic =
              await value159.current.ensureModel(value169);
            if (!value286 || value286.path !== value2) return null;
            let model: Dynamic = value286.model;
            return options === "children"
              ? (0, runtime.selectionChildren)(model, input2)
              : options === "parents"
                ? (0, runtime.selectionParents)(model, input2)
                : options === "siblings"
                  ? (0, runtime.selectionSiblingIds)(model, input2)
                  : (0, runtime.selectionAdjacentSiblings)(
                      model,
                      input2,
                      options,
                    );
          },
          [value169, value2],
        ),
        value181: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value182: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
          ): Promise<Dynamic> => {
            let state2: Dynamic = {
              tids: [...input2],
              did: "none",
            };
            if (
              !Number.isFinite(options) ||
              !Number.isFinite(context) ||
              (options === 0 && context === 0)
            )
              return state2;
            let value287: Dynamic =
              await value159.current.ensureModel(value169);
            if (!value287 || value287.path !== value2) return state2;
            let { targets: value288 }: Dynamic = (0,
            runtime.promotedSvgSelection)(value287.model, input2);
            if (value288.length === 0) return state2;
            if (
              (0, runtime.canMovePositionedSelection)(value287.model, value288)
            ) {
              if (
                !(0, runtime.hasPositionedSelectionAxes)(
                  value287.model,
                  value288,
                  options,
                  context,
                )
              )
                return state2;
              let value292: Dynamic = value288.join(","),
                current: Dynamic = value181.current,
                value293: Dynamic = Date.now(),
                value294: Dynamic =
                  current != null &&
                  current.key === value292 &&
                  value293 - current.at < runtime.ModelModelStateLimit &&
                  value287.undo.length === current.depth &&
                  value287.undo[current.depth - 1] === current.top,
                value295: Dynamic = await value159.current.mutate(
                  value169,
                  (input3?: Dynamic, options2?: Dynamic): Dynamic =>
                    options2.path !== value2
                      ? false
                      : ((0, runtime.nudgeModelSelection)(
                          input3,
                          value288,
                          options,
                          context,
                        ),
                        true),
                  {
                    structural: false,
                    pushUndo: !value294,
                  },
                ),
                value296: Dynamic =
                  value295 === "applied" || value295 === "applied-dirty",
                value297: Dynamic = value159.current.state(value169);
              value296 &&
                value297 &&
                (value181.current = {
                  key: value292,
                  at: value293,
                  depth: value297.undo.length,
                  top: value297.undo[value297.undo.length - 1],
                });
              return value296
                ? {
                    tids: [...input2],
                    did: "nudged",
                  }
                : state2;
            }
            let value289: Dynamic = null,
              value290: Dynamic = input2.filter(
                (input3?: Dynamic): Dynamic =>
                  value287.model.element(input3) != null,
              );
            if (
              !(0, runtime.canReorderSelection)(
                value287.model,
                value290,
                options < 0 || context < 0 ? -1 : 1,
              )
            )
              return state2;
            value286?.();
            let value291: Dynamic = await value159.current.mutate(
              value169,
              (input3?: Dynamic, options2?: Dynamic): Dynamic =>
                options2.path !== value2
                  ? false
                  : ((value289 = (0, runtime.reorderModelSelection)(
                      input3,
                      value290,
                      options < 0 || context < 0 ? -1 : 1,
                    )),
                    value289 != null),
              {
                structural: true,
              },
            );
            value181.current = null;
            return !(value291 === "applied" || value291 === "applied-dirty") ||
              value289 == null
              ? state2
              : {
                  tids: (0, runtime.modelIdsFromElements)(value289),
                  did: "reordered",
                };
          },
          [value169, value2],
        ),
        value183: Dynamic = (0, runtime.reactCanvasShape.useRef)(
          Promise.resolve(),
        ),
        value184: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
          ): Dynamic => {
            let callback5: Dynamic = (): Dynamic => {
                let value288: Dynamic,
                  promise: Dynamic = new Promise(
                    (input3?: Dynamic): Dynamic => {
                      value288 = setTimeout(
                        (): Dynamic =>
                          input3({
                            tids: [...input2],
                            did: "timeout",
                          }),
                        1e4,
                      );
                    },
                  );
                return Promise.race([
                  value182(input2, options, context, value286),
                  promise,
                ]).finally((): Dynamic => clearTimeout(value288));
              },
              value287: Dynamic = value183.current.then(callback5, callback5);
            value183.current = value287.catch((): Dynamic => {});
            return value287;
          },
          [value182],
        ),
        value185: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic =
                await value159.current.ensureModel(value169),
              value287: Dynamic = (0, runtime.createPreviewHandle)(
                value84.current,
              );
            if (!value286 || value286.path !== value2 || !value287) return null;
            let value288: Dynamic = input2.map(
                (input3?: Dynamic): Dynamic => value286.model.element(input3),
              ),
              value289: Dynamic = await (0, runtime.inspectFlipSelection)(
                value286.model,
                input2,
                (
                  input3?: Dynamic,
                  options?: Dynamic,
                  context?: Dynamic,
                ): Dynamic =>
                  (0, runtime.inspectPickerSelection)(
                    value287,
                    input3,
                    value169,
                    options,
                    {
                      pose: true,
                      afterPaint: context,
                    },
                  ),
              );
            return (0, runtime.selectionNeedsFlipInspection)(
              value286.model,
              input2,
              value289,
            )
              ? null
              : {
                  tids: input2,
                  picked: value288,
                  facts: value289,
                };
          },
          [value169, value2],
        ),
        value186: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            { tids: tids, picked: picked, facts: facts }: Dynamic,
            options?: Dynamic,
          ): Promise<Dynamic> => {
            let state2: Dynamic = {
                flipped: [],
              },
              value286: Dynamic = await value159.current.mutate(
                value169,
                (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                  options2.path !== value2 ||
                  tids.some(
                    (input3?: Dynamic, options3?: Dynamic): Dynamic =>
                      input2.element(input3) !== picked[options3],
                  )
                    ? false
                    : ((state2 = (0, runtime.flipModelSelection)(
                        input2,
                        tids,
                        options,
                        facts,
                      )),
                      state2.flipped.length > 0),
                {
                  structural: false,
                  pushUndo: true,
                },
              ),
              value287: Dynamic =
                value286 === "applied" || value286 === "applied-dirty",
              value288: Dynamic = !value287 && state2.flipped.length > 0;
            return {
              flipped: value287 ? state2.flipped.length : 0,
              ...(state2.refused !== undefined && !value288
                ? {
                    refused: state2.refused,
                  }
                : {}),
            };
          },
          [value169, value2],
        ),
        value187: Dynamic = (0, runtime.reactCanvasShape.useRef)(
          Promise.resolve(),
        ),
        value188: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = value187.current.then(input2, input2);
            value187.current = value286.catch((): Dynamic => {});
            return value286;
          },
          [],
        ),
        value189: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic): Dynamic => {
            let entries: Dynamic = new Map();
            for (let [value286, value287] of input2 as Dynamic) {
              let value288: Dynamic = (0, runtime.normalizeStyleEdits)(
                value287,
              );
              value288.length > 0 && entries.set(value286, value288);
            }
            return entries.size === 0
              ? Promise.resolve(false)
              : value188(async (): Promise<Dynamic> => {
                  let value286: Dynamic = await value159.current.mutate(
                    value169,
                    (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                      if (options2.path !== value2) return false;
                      let flag2: Dynamic = false,
                        value287: Dynamic = (0,
                        runtime.arrowSnapshotsForPropertyChange)(
                          options2.model,
                          entries.keys(),
                          [...entries.values()]
                            .flat()
                            .map(([input4]: Dynamic): Dynamic => input4),
                        );
                      for (let [value288, value289] of entries as Dynamic)
                        if (options2.model.element(value288))
                          for (let [value290, value291] of value289 as Dynamic)
                            input3.setStyleProperty(
                              value288,
                              value290,
                              value291,
                            ) && (flag2 = true);
                      flag2 &&
                        (0, runtime.restoreArrowSnapshots)(
                          options2.model,
                          value287,
                        );
                      if (flag2)
                        for (let [value288, value289] of [
                          ...entries.values(),
                        ].flat() as Dynamic) {
                          let value290: Dynamic =
                            value288 === "font-family" && value289
                              ? (0, runtime.knownWebFontFamily)(
                                  (0, runtime.firstFontFamily)(value289),
                                )
                              : undefined;
                          value290 !== undefined &&
                            input3.ensureWebfontLink(value290);
                        }
                      return flag2;
                    },
                    {
                      structural: false,
                      pushUndo: options?.undo ?? true,
                    },
                  );
                  return value286 === "applied" || value286 === "applied-dirty";
                });
          },
          [value169, value2, value188],
        ),
        value190: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (): Dynamic =>
            value159.current
              .ensureModel(value169)
              .then(
                (input2?: Dynamic): Dynamic =>
                  input2 && input2.path === value2
                    ? input2.model.pageFill()
                    : null,
              ),
          [value169, value2],
        ),
        value191: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value192: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = input2.map(
              (input3?: Dynamic): Dynamic => ({
                prop: input3.prop,
                value:
                  input3.value === null
                    ? null
                    : (0, runtime.isSafeBackgroundStyle)(
                        input3.prop,
                        input3.value,
                      ),
              }),
            );
            return value286.length === 0 ||
              value286.some(
                (input3?: Dynamic, options?: Dynamic): Dynamic =>
                  !runtime.CssEditValidationBackgroundBackgroundColorSet.has(
                    input3.prop,
                  ) ||
                  (input2[options].value !== null && input3.value === null),
              )
              ? Promise.resolve(false)
              : value188(async (): Promise<Dynamic> => {
                  let value287: Dynamic = value170(value169),
                    value288: Dynamic = value286
                      .map((input3?: Dynamic): Dynamic => input3.prop)
                      .join("+"),
                    current: Dynamic = value191.current,
                    value289: Dynamic = Date.now(),
                    value290: Dynamic =
                      current != null &&
                      value287 != null &&
                      current.key === value288 &&
                      value289 - current.at < runtime.ModelModelStateLimit &&
                      value287.undo.length === current.depth &&
                      value287.undo[current.depth - 1] === current.top,
                    value291: Dynamic = await value159.current.mutate(
                      value169,
                      (input3?: Dynamic, options?: Dynamic): Dynamic =>
                        options.path !== value2
                          ? false
                          : input3.setPageFill(value286),
                      {
                        structural: false,
                        pushUndo: !value290,
                      },
                    ),
                    value292: Dynamic =
                      value291 === "applied" || value291 === "applied-dirty",
                    value293: Dynamic = value170(value169);
                  value292 &&
                    value293 &&
                    (value191.current = {
                      key: value288,
                      at: value289,
                      depth: value293.undo.length,
                      top: value293.undo[value293.undo.length - 1],
                    });
                  return value292;
                });
          },
          [value169, value2, value188, value170],
        ),
        value193: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value194: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          value188((): Dynamic => {
            let value286: Dynamic = value170(value169);
            value193.current = value286 ? value286.model.serialize() : null;
          });
        }, [value188, value170, value169]),
        value195: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (): Dynamic =>
            value188((): Dynamic => {
              let current: Dynamic = value193.current;
              value193.current = null;
              return current == null
                ? false
                : value159.current.pushUndoSnapshot(value169, current);
            }),
          [value188, value169],
        ),
        [value196, value197]: Dynamic = (0, runtime.reactCanvasShape.useState)(
          null,
        ),
        value198: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value199: Dynamic = (0, runtime.reactCanvasShape.useRef)(false),
        value200: Dynamic = (0, runtime.reactCanvasShape.useRef)(0),
        value201: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let [items, items2]: Dynamic = [value198.current, value170(value169)],
            value286: Dynamic = parseInt(
              items?.el.getAttribute(runtime.DcTplAttribute) ?? "",
              10,
            );
          return items &&
            items2 &&
            Number.isSafeInteger(value286) &&
            items2.model.element(value286) === items.el
            ? value286
            : null;
        }, [value169, value170]),
        value202: Dynamic = (0, runtime.reactCanvasShape.useRef)(new WeakMap()),
        value203: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = (value202.current.get(input2) ?? 0) + 1;
            value202.current.set(input2, value286);
            return value286;
          },
          [],
        ),
        value204: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (element?: Dynamic, options?: Dynamic): Dynamic => (
            value203(element),
            value188(
              (): Dynamic =>
                value159.current.mutate(
                  value169,
                  (input2?: Dynamic, options2?: Dynamic): Dynamic => {
                    let value286: Dynamic = parseInt(
                      element.getAttribute(runtime.DcTplAttribute) ?? "",
                      10,
                    );
                    return options2.path !== value2 ||
                      options2.model.element(value286) !== element
                      ? false
                      : options
                          .map(
                            ([input3, input4]: Dynamic): Dynamic =>
                              input2.setStyleProperty(value286, input3, input4),
                          )
                          .some(Boolean);
                  },
                  {
                    structural: false,
                    pushUndo: true,
                  },
                ),
            )
          ),
          [value2, value169, value188, value203],
        ),
        value205: Dynamic = (0, runtime.reactCanvasShape.useRef)(value204);
      value205.current = value204;
      let value206: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let current: Dynamic = value198.current;
            if (!current) return;
            let value286: Dynamic = value201() !== null;
            value198.current = null;
            value197(null);
            (0, runtime.updateElementSessionState)(value2, {
              cropping: null,
            });
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value287 && (0, runtime.setPickerScrubbing)(value287, false);
            let callback5: Dynamic = (): Dynamic => {
                if (value287)
                  for (let value290 of current.tids as Dynamic)
                    (0, runtime.unpatchPickerStyle)(
                      value287,
                      value169,
                      [value290],
                      current.token,
                    );
              },
              value288: Dynamic = (0, runtime.normalizeStyleEdits)(
                (0, runtime.imageCropStyleEdits)(
                  current.at.frame,
                  current.at.natural,
                  current.live,
                ),
              ),
              value289: Dynamic = JSON.stringify(value288) !== current.wrote;
            input2 &&
              value289 &&
              !value286 &&
              ((0, runtime.announce)(
                "The picture changed while you were cropping, so the crop was not kept.",
              ),
              value(
                "The picture changed while you were cropping, so the crop was not kept.",
              ));
            current.closed =
              !input2 || !value286 ? "dropped" : value289 ? "wrote" : "held";
            if (current.closed !== "wrote") return callback5();
            value199.current = true;
            value103.current = null;
            (0, runtime.updateElementSessionState)(value2, {
              target: null,
            });
            value204(current.el, value288)
              .then((input3?: Dynamic): Dynamic => {
                input3 === "applied" || input3 === "applied-dirty"
                  ? (0, runtime.announce)("Cropped.", {
                      ifIdle: true,
                    })
                  : callback5();
              }, callback5)
              .finally((): Dynamic => {
                value199.current = false;
                value287 && (0, runtime.repostPickerChrome)(value287);
              });
          },
          [value2, value169, value201, value204, value],
        ),
        value207: Dynamic = value137 === true && !value83,
        value208: Dynamic = (0, runtime.reactCanvasShape.useRef)(value207);
      value208.current = value207;
      let value209: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options: Dynamic = false): Dynamic => {
            if (value198.current) return value206(true);
            let current: Dynamic = value103.current,
              value286: Dynamic = value170(value169)
                ?.model.tagName(input2)
                ?.toLowerCase(),
              value287: Dynamic = (0, runtime.createPreviewHandle)(
                value84.current,
              );
            if (
              !value207 ||
              value199.current ||
              !value287 ||
              !current?.media ||
              current.media.tid !== input2 ||
              (0, runtime.SessionElementStateGet)(value2).target === null ||
              "off" in (0, runtime.SessionElementStateGet)(value2).target ||
              (value286 !== "img" && value286 !== "video")
            )
              return;
            let value288: Dynamic = value170(value169)?.model.element(input2);
            if (!value288) return;
            let { media: value289 }: Dynamic = current,
              state2: Dynamic = {
                w: current.w * (1 - value289.inset[0] - value289.inset[2]),
                h: current.h * (1 - value289.inset[1] - value289.inset[3]),
              },
              value290: Dynamic = (0, runtime.MediaObjectCropEvery)(
                state2,
                value289,
                (0, runtime.cropFromObjectStyles)(
                  state2,
                  value289,
                  value289.view,
                ),
              );
            options
              ? ((document as Dynamic).activeElement instanceof HTMLElement &&
                  (document as Dynamic).activeElement.tagName === "IFRAME" &&
                  (document as Dynamic).activeElement.blur(),
                (window as Dynamic).focus())
              : (0, runtime.focusCanvasDocument)();
            let value291: Dynamic = "crop-" + String(Date.now());
            (0, runtime.setPickerScrubbing)(value287, true);
            (0, runtime.patchPickerStyle)(
              value287,
              value169,
              [input2],
              Object.fromEntries(
                (0, runtime.imageCropStyleEdits)(
                  state2,
                  value289,
                  value290,
                ).map(
                  ([input3, input4]: Dynamic): Dynamic => [
                    input3,
                    input4 ?? "none",
                  ],
                ),
              ),
              value291,
            );
            value203(value288);
            value198.current = {
              tid: input2,
              tids: new Set([input2]),
              token: value291,
              el: value288,
              live: value290,
              wrote: JSON.stringify(
                (0, runtime.normalizeStyleEdits)(
                  (0, runtime.imageCropStyleEdits)(state2, value289, value290),
                ),
              ),
              at: {
                frame: state2,
                natural: {
                  w: value289.w,
                  h: value289.h,
                },
              },
            };
            let value292: Dynamic =
                value170(value169)?.model.attributes(input2)?.src,
              value293: Dynamic = (0, runtime.MediaObjectCropSupports)()
                ? undefined
                : runtime.ThisBrowserCanTZoomAPictureMessage;
            value197({
              tid: input2,
              live: value290,
              src:
                (0, runtime.inlineImageUrl)(value292) ??
                (value292 !== undefined
                  ? (0, runtime.inlineImagePreview)(value292)
                  : null),
              noZoom: value293,
            });
            (0, runtime.updateElementSessionState)(value2, {
              cropping: input2,
            });
          },
          [value2, value169, value170, value207, value206],
        ),
        value210: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let [items, items2, items3]: Dynamic = [
            value198.current,
            (0, runtime.createPreviewHandle)(value84.current),
            value201(),
          ];
          return !items || !items2 || items3 === null
            ? false
            : (items3 === items.tid ||
                ((0, runtime.unpatchPickerStyle)(
                  items2,
                  value169,
                  [items.tid],
                  items.token,
                ),
                (items.tid = items3),
                items.tids.add(items3),
                (0, runtime.patchPickerStyle)(
                  items2,
                  value169,
                  [items3],
                  Object.fromEntries(
                    (0, runtime.imageCropStyleEdits)(
                      items.at.frame,
                      items.at.natural,
                      items.live,
                    ).map(
                      ([input2, input3]: Dynamic): Dynamic => [
                        input2,
                        input3 ?? "none",
                      ],
                    ),
                  ),
                  items.token,
                ),
                value197(
                  (input2?: Dynamic): Dynamic =>
                    input2 && {
                      ...input2,
                      tid: items3,
                    },
                ),
                (0, runtime.updateElementSessionState)(value2, {
                  cropping: items3,
                })),
              true);
        }, [value2, value169, value201]),
        value211: Dynamic = (0, runtime.reactCanvasShape.useRef)(value210);
      value211.current = value210;
      let value212: Dynamic = (0, runtime.reactCanvasShape.useRef)(value206);
      value212.current = value206;
      let value213: Dynamic = (0, runtime.reactCanvasShape.useRef)(value209);
      value213.current = value209;
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic => value212.current(false),
        [],
      );
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value207 || value212.current(false);
      }, [value207]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic => value212.current(false),
        [value93],
      );
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value23 !== true && value212.current(true);
      }, [value23]);
      let value214: Dynamic = (0, runtime.reactCanvasShape.useMemo)(
          (): Dynamic =>
            value196 && {
              tid: value196.tid,
              live: value196.live,
              src: value196.src,
              zoomDisabledReason: value196.noZoom,
              onLive: (
                input2?: Dynamic,
                options?: Dynamic,
                context?: Dynamic,
              ): Dynamic => {
                let current: Dynamic = value198.current,
                  value286: Dynamic = (0, runtime.createPreviewHandle)(
                    value84.current,
                  );
                if (!(!current || !value286 || !value210())) {
                  if (
                    input2.zoom > current.live.zoom &&
                    (0, runtime.MediaObjectCropZoom)(options, context, input2)
                  ) {
                    Date.now() - value200.current > 2e3 &&
                      (0, runtime.announce)(
                        runtime.YouCanTCropAnyFurtherAtMessage,
                      );
                    value200.current = Date.now();
                    return;
                  }
                  current.live = input2;
                  current.at = {
                    frame: options,
                    natural: context,
                  };
                  value197(
                    (input3?: Dynamic): Dynamic =>
                      input3 && {
                        ...input3,
                        live: input2,
                      },
                  );
                  (0, runtime.holdPickerStyle)(
                    value286,
                    value169,
                    [current.tid],
                    Object.fromEntries(
                      (0, runtime.imageCropStyleEdits)(
                        options,
                        context,
                        input2,
                      ).map(
                        ([input3, input4]: Dynamic): Dynamic => [
                          input3,
                          input4 ?? "none",
                        ],
                      ),
                    ),
                    current.token,
                  );
                }
              },
              onDone: value206,
              onGesture: (input2?: Dynamic): Dynamic =>
                value9?.("element-crop", input2),
              onSideStart: (
                input2?: Dynamic,
                options?: Dynamic,
                context?: Dynamic,
              ): Dynamic => value281.current(input2, options, context),
            },
          [value196, value169, value210, value206, value9],
        ),
        value215: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(value169);
            if (!value286) return [];
            let items: Dynamic = [];
            for (let value287 of input2 as Dynamic) {
              let value288: Dynamic = value286.model.element(value287);
              if (!value288) continue;
              let items2: Dynamic = [];
              for (let value291: Dynamic = value287; value291 !== null; ) {
                let value292: Dynamic = value286.model.parentTid(value291);
                items2.unshift(
                  value286.model.childTids(value292).indexOf(value291),
                );
                value291 = value292;
              }
              let value289: Dynamic =
                  value286.model.tagName(value287)?.toLowerCase() ?? "",
                callback5: Dynamic = (input3?: Dynamic): Dynamic =>
                  value289 === "img"
                    ? (value288.getAttribute("alt") ?? "")
                    : (0, runtime.extractVisibleElementText)(value288, {
                        visits: input3,
                      }),
                value290: Dynamic = (0, runtime.isTextCapableElement)(
                  value288,
                  value286.model.isTextEditable(value287),
                );
              items.push({
                path: String(value287) + ":" + items2.join("/"),
                kind: value290 === "box" ? "shape" : value290,
                words: callback5,
              });
            }
            return items;
          },
          [value170, value169],
        ),
        value216: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(value169);
            return value286
              ? input2
                  .filter(
                    (input3?: Dynamic): Dynamic =>
                      value286.model.element(input3) != null,
                  )
                  .map((input3?: Dynamic): Dynamic => {
                    let value287: Dynamic = value286.model.element(input3),
                      value288: Dynamic = value286.model.isTextEditable(input3);
                    return {
                      tid: input3,
                      kind: (0, runtime.isTextCapableElement)(
                        value287,
                        value288,
                      ),
                      tag: value287.tagName.toLowerCase(),
                      editable: value288,
                    };
                  })
              : [];
          },
          [value170, value169],
        ),
        value217: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            input2?: Dynamic,
            options: Dynamic = "root-end",
            context?: Dynamic,
          ): Promise<Dynamic> => {
            let items: Dynamic = [];
            await value159.current.mutate(
              value169,
              (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                if (options2.path !== value2) return false;
                let callback5: Dynamic = (input4?: Dynamic): Dynamic => {
                    let value290: Dynamic =
                        context != null &&
                        options2.model
                          .topLevelTags(input4)
                          .filter(
                            (input5?: Dynamic): Dynamic =>
                              !runtime.SelectionActionsHelmetScHelmetPattern.test(
                                input5,
                              ),
                          ).length === 1
                          ? context
                          : null,
                      value291: Dynamic =
                        value290 != null || options === "page"
                          ? (0, runtime.emptyArtboardDropTarget)(
                              options2.model,
                              input4,
                            )
                          : null,
                      value292: Dynamic = (0, runtime.pasteParentTarget)(
                        options,
                        value290,
                        value291,
                        input4,
                      ),
                      value293: Dynamic =
                        options === "root-end" &&
                        (0, runtime.containsFlowPastedElements)(
                          value292 != null,
                          input4,
                        ),
                      value294: Dynamic = value291
                        ? value291.placement
                        : options === "stage"
                          ? (0, runtime.defaultInsertionPoint)(
                              options2.model,
                              input4,
                            )
                          : value293
                            ? (0, runtime.insertionPointForSelection)(
                                options2.model,
                                [],
                                input4,
                              )
                            : {
                                targetTid: null,
                                position: "root-end",
                              };
                    return {
                      html: value292
                        ? (0, runtime.positionPastedHtml)(input4, value292)
                        : input4,
                      placement: value294,
                    };
                  },
                  value286: Dynamic = callback5(input2),
                  value287: Dynamic =
                    options === "stage"
                      ? (0, runtime.wrapInlinePastedHtml)(input2)
                      : input2,
                  value288: Dynamic =
                    value287 !== input2 ? callback5(value287) : null,
                  value289: Dynamic =
                    value288 &&
                    (0, runtime.sameInsertionPoint)(
                      value288.placement,
                      value286.placement,
                    )
                      ? value288
                      : value286;
                items = (0, runtime.insertHtmlIntoModel)(
                  options2,
                  value289.html,
                  value289.placement,
                );
                return items.length > 0;
              },
              {
                structural: true,
              },
            );
            return items;
          },
          [value169, value2],
        ),
        value218: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
          ): Dynamic => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            return (0, runtime.placeElementAtMeasuredPoint)(
              {
                state: (): Dynamic => value170(value169),
                measure: (
                  input3?: Dynamic,
                  options2?: Dynamic,
                  context2?: Dynamic,
                ): Dynamic =>
                  value287
                    ? (0, runtime.requestInsertionContainerTransform)(
                        value287,
                        value169,
                        input3,
                        options2,
                        context2,
                      )
                    : Promise.resolve(null),
                live: context,
                replaced: value286,
                mutate: async (input3?: Dynamic): Promise<Dynamic> => {
                  let items: Dynamic = [];
                  await value159.current.mutate(
                    value169,
                    (input4?: Dynamic, options2?: Dynamic): Dynamic =>
                      options2.path !== value2
                        ? false
                        : ((items = input3(options2)), items.length > 0),
                    {
                      structural: true,
                    },
                  );
                  return items;
                },
              },
              input2,
              options,
            );
          },
          [value170, value169, value2],
        ),
        value219: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
            value218(input2, options, context, (): Dynamic => null),
          [value218],
        ),
        value220: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 && (0, runtime.formatPickerText)(value286, input2);
          },
          [],
        ),
        value221: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 &&
              (0, runtime.startPickerTextEdit)(
                value286,
                options,
                input2,
                context,
              );
          },
          [],
        ),
        value222: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          if (value170(value169)?.model.findDeckStage() != null) return true;
          try {
            return (
              value84.current?.contentDocument?.querySelector("deck-stage") !=
              null
            );
          } catch {
            return false;
          }
        }, [value170, value169]),
        value223: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = value170(value169);
          return value286
            ? (0, runtime.collectFontFamilies)(value286.model.serialize())
            : [];
        }, [value170, value169]),
        value224: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value225: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = value170(value169),
            current: Dynamic = value224.current,
            value287: Dynamic = value286?.stampGen ?? -1,
            value288: Dynamic = (0, runtime.getDesignSystemColorVariables)();
          if (
            current &&
            value286 &&
            current.model === value286.model &&
            current.stamp === value287 &&
            current.gen === value132.current &&
            current.tokens === value288
          )
            return current.census;
          let value289: Dynamic = value286 ? value286.model.serialize() : "",
            state2: Dynamic = {
              fonts: value286 ? (0, runtime.collectFontFamilies)(value289) : [],
              webfonts: value286
                ? (0, runtime.collectGoogleFontFamilies)(value289)
                : [],
              sizes: value286 ? (0, runtime.collectFontSizes)(value289) : [],
              colors: value286
                ? (0, runtime.collectColorTokens)(value289, value288)
                : new Map(),
              roles: value286
                ? (0, runtime.collectFontSizeFamilyUsage)(value289)
                : new Map(),
              families: value286
                ? (0, runtime.collectTypographyRoles)(value289)
                : new Map(),
            };
          value224.current = value286
            ? {
                model: value286.model,
                stamp: value287,
                gen: value132.current,
                tokens: value288,
                census: state2,
              }
            : null;
          return state2;
        }, [value170, value169]),
        value226: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            if (!(0, runtime.validatePastedAttributeEdits)(options))
              return false;
            let flag2: Dynamic = false;
            await value159.current.mutate(
              value169,
              (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                if (options2.path !== value2) return false;
                for (let value286 of options2.model.elementsByAttr(
                  "src",
                  input2,
                ) as Dynamic) {
                  if (value286.tagName.toLowerCase() !== "img") continue;
                  let value287: Dynamic = parseInt(
                    value286.getAttribute("data-dc-tpl") ?? "-1",
                    10,
                  );
                  if (!(value287 < 0)) {
                    for (let [value288, value289] of Object.entries(
                      options,
                    ) as Dynamic)
                      options2.model.setAttribute(value287, value288, value289);
                    flag2 = true;
                  }
                }
                return flag2;
              },
              {
                structural: false,
              },
            );
            return flag2;
          },
          [value169, value2],
        ),
        value227: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            if (!(0, runtime.validatePastedAttributeEdits)(options))
              return false;
            value212.current(false);
            let value286: Dynamic = await value159.current.mutate(
              value169,
              (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                if (options2.path !== value2) return false;
                let value287: Dynamic = options2.model.element(input2);
                if (!value287 || value287.tagName.toLowerCase() !== "img")
                  return false;
                for (let [value288, value289] of Object.entries(
                  options,
                ) as Dynamic)
                  options2.model.setAttribute(input2, value288, value289);
                if (
                  (0, runtime.MediaObjectCropTest)(
                    (input4?: Dynamic): Dynamic =>
                      options2.model.inlineStyleValue(input2, input4),
                  )
                )
                  for (let value288 of [
                    "object-view-box",
                    "object-position",
                  ] as Dynamic)
                    input3.setStyleProperty(input2, value288, null);
                return true;
              },
              {
                structural: false,
                pushUndo: true,
              },
            );
            return value286 === "applied" || value286 === "applied-dirty";
          },
          [value169, value2],
        ),
        value228: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            try {
              return (0, runtime.findPreviewMediaElement)(
                value84.current?.contentDocument,
                runtime.DcTplAttribute,
                input2,
                value169,
              );
            } catch {
              return null;
            }
          },
          [value169],
        ),
        value229: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(value169);
            return value286
              ? (0, runtime.createVideoElementIdentity)(value286.model, input2)
              : null;
          },
          [value170, value169],
        ),
        value230: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            if (!(0, runtime.isValidVideoDimensions)(options)) return "refused";
            let text: Dynamic = "gone";
            value212.current(false);
            let value286: Dynamic = await value159.current.mutate(
              value169,
              (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                if (options2.path !== value2) return false;
                let value287: Dynamic = (0,
                runtime.resolveVideoElementIdentity)(options2.model, input2);
                if (typeof value287 != "number") {
                  text = value287;
                  return false;
                }
                if (
                  (0, runtime.MediaObjectCropTest)(
                    (input4?: Dynamic): Dynamic =>
                      options2.model.inlineStyleValue(value287, input4),
                  )
                )
                  for (let value288 of [
                    "object-view-box",
                    "object-position",
                  ] as Dynamic)
                    input3.setStyleProperty(value287, value288, null);
                options2.model.setAttribute(value287, "src", options.src);
                options2.model.setAttribute(
                  value287,
                  "width",
                  String(options.width),
                );
                options2.model.setAttribute(
                  value287,
                  "height",
                  String(options.height),
                );
                options2.model.setAttribute(value287, "poster", null);
                return true;
              },
              {
                structural: false,
                pushUndo: true,
              },
            );
            return value286 === "applied" || value286 === "applied-dirty"
              ? "ok"
              : text;
          },
          [value169, value2],
        ),
        value231: Dynamic = (0, runtime.reactCanvasShape.useRef)(null),
        value232: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = value159.current.state(value169);
          if (!value286) return null;
          let value287: Dynamic = value286.model.serialize(),
            current: Dynamic = value231.current,
            value288: Dynamic =
              current && current.src === value287
                ? current.tids
                : value286.model
                    .textEditables()
                    .map((input2?: Dynamic): Dynamic => input2.tid);
          value231.current = {
            src: value287,
            tids: value288,
          };
          return value288;
        }, [value169]),
        value233: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            input2?: Dynamic,
            options?: Dynamic,
            context: Dynamic = "plain",
            value286: Dynamic = [],
          ): Promise<Dynamic> => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            if (!value287 || !(await value159.current.ensureModel(value169)))
              return null;
            let value288: Dynamic = await (0, runtime.pickAtPoint)(
              value287,
              input2,
              options,
              context,
              value286,
              value232() ?? [],
            );
            if (!value288) return null;
            let value289: Dynamic = value159.current.state(value169),
              value290: Dynamic = value289
                ? value289.model
                    .childTids(null)
                    .filter(
                      (input3?: Dynamic): Dynamic =>
                        !runtime.SelectionActionsHelmetScHelmetPattern.test(
                          value289.model.tagName(input3) ?? "",
                        ),
                    )
                : [];
            if ("empty" in value288) {
              if (!value289) return null;
              let value295: Dynamic =
                value290.length === 1
                  ? value289.model.element(value290[0])
                  : null;
              return value290.length === 0 ||
                (value295 != null &&
                  (0, runtime.pickerElementSignature)(
                    value295,
                    (input3?: Dynamic): Dynamic =>
                      (0, runtime.classifyElementStyleKind)(input3) === "text",
                  ))
                ? value288
                : null;
            }
            if (!value289 || !value289.model.element(value288.tid)) return null;
            let value291: Dynamic =
              value289.model.tagName(value288.tid)?.toLowerCase() ?? "";
            if (
              !(0, runtime.equivalentDesignImportTags)(value291, value288.tag)
            )
              return null;
            let value292: Dynamic =
                value288.root &&
                value290.length === 1 &&
                value290[0] === value288.tid,
              text: Dynamic = value288.text,
              value293: Dynamic =
                !value292 && text ? value289.model.element(text.tid) : null,
              value294: Dynamic =
                text &&
                value293 &&
                value289.model.element(value288.tid)?.contains(value293) &&
                (0, runtime.equivalentDesignImportTags)(
                  value289.model.tagName(text.tid)?.toLowerCase() ?? "",
                  text.tag,
                ) &&
                value289.model.isTextEditable(text.tid) &&
                !value289.model.isTextEditable(value288.tid)
                  ? {
                      tid: text.tid,
                      rect: text.rect,
                    }
                  : null;
            return {
              tid: value288.tid,
              rect: value288.rect,
              root: value292,
              page: value292 && value288.page,
              text: value294,
            };
          },
          [value169, value232],
        ),
        value234: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            if (!value286 || !(await value159.current.ensureModel(value169)))
              return null;
            let value287: Dynamic = await (0, runtime.pickInBox)(
              value286,
              input2,
              options,
            );
            if (value287 == null) return null;
            let value288: Dynamic = value159.current.state(value169);
            return value288
              ? [
                  ...new Set(
                    value287
                      .filter(
                        (input3?: Dynamic): Dynamic =>
                          value288.model.element(input3.tid) != null &&
                          (0, runtime.equivalentDesignImportTags)(
                            value288.model.tagName(input3.tid)?.toLowerCase() ??
                              "",
                            input3.tag,
                          ),
                      )
                      .map((input3?: Dynamic): Dynamic => input3.tid),
                  ),
                ]
              : null;
          },
          [value169],
        ),
        value235: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
          ): Dynamic => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            return value287
              ? ((0, runtime.setPickerSelection)(
                  value287,
                  input2 ? [...input2] : null,
                  options,
                  context,
                  value286,
                ),
                true)
              : false;
          },
          [],
        ),
        value236: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = (0, runtime.createPreviewHandle)(
            value84.current,
          );
          value286 && (0, runtime.clearPickerPart)(value286);
        }, []),
        value237: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 &&
              (0, runtime.finishExitedPickerDrag)(
                value286,
                input2,
                options,
                !!context,
              );
          },
          [],
        ),
        value238: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 && (0, runtime.cancelPickerBox)(value286, input2);
          },
          [],
        ),
        value239: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 &&
              (0, runtime.armPickerByClick)(value286, input2, options);
          },
          [],
        ),
        value240: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = (0, runtime.createPreviewHandle)(
            value84.current,
          );
          value286 && (0, runtime.beginPickerTextPlacing)(value286);
        }, []),
        value241: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
                value84.current,
              ),
              value287: Dynamic = value159.current.state(value169);
            if (
              !value286 ||
              !value287 ||
              value287.model.element(input2.tid) !== input2.el
            )
              return;
            let value288: Dynamic = await (0, runtime.inspectPickerSelection)(
              value286,
              input2.tid,
              value169,
              [...input2.pinned.keys()],
              {
                unpinned: true,
                afterPaint: options,
              },
            );
            if (
              value159.current.state(value169) !== value287 ||
              value287.model.element(input2.tid) !== input2.el
            )
              return;
            if (!value288) {
              options ||
                setTimeout((): Dynamic => {
                  value241(input2, true);
                }, 300);
              return;
            }
            let value289: Dynamic = (0, runtime.frozenInheritedStyleEdits)(
              input2.pinned,
              value288.computed,
              input2.freeze,
              (input3?: Dynamic): Dynamic =>
                value287.model.inlineStyleValue(input2.tid, input3),
            );
            value289.length !== 0 &&
              (await value159.current.mutate(
                value169,
                (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                  if (
                    options2.path !== value2 ||
                    options2.model.element(input2.tid) !== input2.el
                  )
                    return false;
                  let flag2: Dynamic = false;
                  for (let value290 of value289 as Dynamic)
                    input3.setStyleProperty(input2.tid, value290, null) &&
                      (flag2 = true);
                  return flag2;
                },
                {
                  structural: false,
                  pushUndo: false,
                },
              ));
          },
          [value169, value2],
        ),
        value242: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
            extra?: Dynamic,
          ): Promise<Dynamic> => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            if (
              !value287 ||
              !extra.includes(options) ||
              !(await value159.current.ensureModel(value169))
            )
              return null;
            let value288: Dynamic = await (0, runtime.beginPickerMove)(
              value287,
              input2,
              options,
              context?.x ?? null,
              context?.y ?? null,
              value286,
            );
            if (
              value288 == null ||
              typeof value288 != "object" ||
              !Array.isArray(value288.tids) ||
              value288.tids.length > 500
            ) {
              (0, runtime.cancelPickerMove)(value287, input2);
              return null;
            }
            let value289: Dynamic = value288.tids.filter(
              (input3?: Dynamic): Dynamic =>
                Number.isInteger(input3) && input3 >= 0,
            );
            if (
              value289.length !== value288.tids.length ||
              value289.length === 0 ||
              !value289.every(
                (input3?: Dynamic): Dynamic => extra.includes(input3),
              )
            ) {
              (0, runtime.cancelPickerMove)(value287, input2);
              return null;
            }
            let value290: Dynamic = value159.current.state(value169);
            if (
              !value290 ||
              value289.some(
                (input3?: Dynamic): Dynamic => !value290.model.element(input3),
              ) ||
              typeof value288.tag != "string" ||
              !(0, runtime.equivalentDesignImportTags)(
                value290.model.tagName(options)?.toLowerCase() ?? "",
                value288.tag,
              )
            ) {
              (0, runtime.cancelPickerMove)(value287, input2);
              return null;
            }
            let rect: Dynamic = value288.rect,
              callback5: Dynamic = (input3?: Dynamic): Dynamic =>
                typeof input3 == "number" &&
                Number.isFinite(input3) &&
                Math.abs(input3) < 1e6
                  ? input3
                  : null,
              value291: Dynamic =
                rect != null && typeof rect == "object"
                  ? {
                      x: callback5(rect.x),
                      y: callback5(rect.y),
                      w: callback5(rect.w),
                      h: callback5(rect.h),
                    }
                  : null;
            if (
              !value291 ||
              value291.x == null ||
              value291.y == null ||
              value291.w == null ||
              value291.h == null
            ) {
              (0, runtime.cancelPickerMove)(value287, input2);
              return null;
            }
            let items: Dynamic = [],
              members: Dynamic = value288.members;
            if (Array.isArray(members))
              for (let value292 of members.slice(0, 500) as Dynamic) {
                if (value292 == null || typeof value292 != "object") continue;
                let value293: Dynamic = value292,
                  tid: Dynamic = value293.tid;
                if (
                  !Number.isInteger(tid) ||
                  !value289.includes(tid) ||
                  typeof value293.tag != "string" ||
                  !/^[a-z][a-z0-9-]{0,63}$/.test(value293.tag) ||
                  !(0, runtime.equivalentDesignImportTags)(
                    value290.model.tagName(tid)?.toLowerCase() ?? "",
                    value293.tag,
                  )
                )
                  continue;
                let rect2: Dynamic = value293.rect,
                  value294: Dynamic =
                    rect2 != null && typeof rect2 == "object"
                      ? {
                          x: callback5(rect2.x),
                          y: callback5(rect2.y),
                          w: callback5(rect2.w),
                          h: callback5(rect2.h),
                        }
                      : null;
                !value294 ||
                  value294.x == null ||
                  value294.y == null ||
                  value294.w == null ||
                  value294.h == null ||
                  items.push({
                    tid: tid,
                    tag: value293.tag,
                    rect: {
                      x: value294.x,
                      y: value294.y,
                      w: value294.w,
                      h: value294.h,
                    },
                  });
              }
            return {
              tids: value289,
              rect: {
                x: value291.x,
                y: value291.y,
                w: value291.w,
                h: value291.h,
              },
              mode: value288.mode === "abs" ? "abs" : "flow",
              members: items,
            };
          },
          [value169],
        ),
        value243: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 &&
              (0, runtime.updatePickerMove)(
                value286,
                input2,
                options.x,
                options.y,
                context,
              );
          },
          [],
        ),
        value244: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 && (0, runtime.cancelPickerMove)(value286, input2);
          },
          [],
        ),
        value245: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = (0, runtime.createPreviewHandle)(
            value84.current,
          );
          value286 && (0, runtime.settlePickerMove)(value286);
        }, []),
        value246: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
          ): Promise<Dynamic> => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            if (!value287) return null;
            let value288: Dynamic = await (0, runtime.finishPickerMove)(
              value287,
              input2,
              options.x,
              options.y,
              context,
            );
            return value288 == null ||
              typeof value288 != "object" ||
              value288.plan == null
              ? null
              : (0, runtime.parseElementMoveSnapshot)(value288.plan, value286);
          },
          [],
        ),
        value247: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (items?: Dynamic): Promise<Dynamic> => {
            if (items.length !== 1) return "refused";
            let items2: Dynamic = [],
              items3: Dynamic = [],
              flag2: Dynamic = false,
              value286: Dynamic;
            try {
              value286 = await value159.current.mutate(
                value169,
                (input2?: Dynamic, options?: Dynamic): Dynamic => {
                  if (options.path !== value2) return false;
                  let value287: Dynamic = options.model.serialize(),
                    items4: Dynamic = [],
                    items5: Dynamic = [],
                    value288: Dynamic = items.map(
                      (input3?: Dynamic): Dynamic => {
                        let value289: Dynamic =
                          input3.block ??
                          (0, runtime.sameParentDropGroup)(
                            options.model,
                            input3.tid,
                            input3.group,
                          );
                        return {
                          ...input3,
                          block:
                            value289 && value289[0] === input3.tid
                              ? value289
                              : null,
                        };
                      },
                    );
                  if (
                    value288.every(
                      (input3?: Dynamic): Dynamic =>
                        (0, runtime.elementMoveRefusal)(
                          options.model,
                          input3,
                        ) === "in-place",
                    )
                  ) {
                    flag2 = true;
                    return false;
                  }
                  for (let value289 of value288 as Dynamic) {
                    let value290: Dynamic = (0, runtime.moveModelElement)(
                      options,
                      value289,
                    );
                    if (!value290) {
                      options.model = options.model.rebuild(value287);
                      return false;
                    }
                    items4.push(
                      value290.newTid,
                      ...value290.groupTids.filter(
                        (input3?: Dynamic): Dynamic =>
                          input3 !== value290.newTid && input3 >= 0,
                      ),
                    );
                    items5.push(...value290.pins);
                  }
                  items2 = [...new Set(items4)];
                  items3 = items5;
                  return true;
                },
                {
                  structural: true,
                },
              );
            } catch {
              return "failed";
            }
            if (flag2) return "in-place";
            if (value286 !== "applied" && value286 !== "applied-dirty")
              return value286 === "refused" ? "refused" : "failed";
            for (let value287 of items3 as Dynamic)
              setTimeout((): Dynamic => {
                value241(value287, false);
              }, 120);
            return {
              newTids: items2,
            };
          },
          [value169, value2, value241],
        ),
        value248: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
          if (!(await value159.current.ensureModel(value169))) return false;
          let value286: Dynamic = value159.current.state(value169);
          if (!value286) return false;
          let value287: Dynamic = value286.model
              .childTids(null)
              .filter(
                (input2?: Dynamic): Dynamic =>
                  !runtime.SelectionActionsHelmetScHelmetPattern.test(
                    value286.model.tagName(input2) ?? "",
                  ),
              ),
            value288: Dynamic =
              value287.length === 1
                ? value286.model.element(value287[0])
                : null;
          return (
            value287.length === 0 ||
            (value288 != null &&
              (0, runtime.pickerElementSignature)(
                value288,
                (input2?: Dynamic): Dynamic =>
                  (0, runtime.classifyElementStyleKind)(input2) === "text",
              ))
          );
        }, [value169]),
        value249: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic): Promise<Dynamic> => {
            if (!(await value159.current.ensureModel(value169))) return false;
            let value286: Dynamic = value159.current.state(value169);
            return (
              value286 != null &&
              (0, runtime.emptyArtboardDropTarget)(value286.model, input2) !=
                null
            );
          },
          [value169],
        ),
        value250: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            return value286
              ? (0, runtime.pickerMoveHold)(value286, input2, options)
              : false;
          },
          [],
        ),
        value251: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 && (0, runtime.exitPickerMove)(value286, input2);
          },
          [],
        ),
        value252: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 && (0, runtime.returnPickerMove)(value286, input2);
          },
          [],
        ),
        value253: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 && (0, runtime.touchPickerMove)(value286, input2);
          },
          [],
        ),
        value254: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
            value286?: Dynamic,
          ): Dynamic => {
            let targetTid: Dynamic = options.targetTid;
            if (targetTid != null) {
              let value289: Dynamic = input2.element(targetTid);
              if (
                !value289 ||
                (0, runtime.containsUneditableSelection)(input2, [targetTid]) ||
                input2.isUneditable(targetTid) ||
                value289.closest("svg") ||
                input2.targetParentLocked(targetTid, options.position)
              )
                return false;
            }
            let value287: Dynamic =
              options.position === "into"
                ? targetTid
                : targetTid != null
                  ? input2.parentTid(targetTid)
                  : null;
            if (
              value287 != null &&
              (input2.isTextEditable(value287) ||
                (0, runtime.containsUneditableSelection)(input2, [value287]))
            )
              return false;
            let value288: Dynamic =
              value287 != null
                ? (input2.tagName(value287)?.toLowerCase() ?? "div")
                : "div";
            if (!(0, runtime.canContainHtmlTag)(value288, context))
              return false;
            if (value286 != null) {
              let value289: Dynamic = input2
                .topLevelTags(value286)
                .map((input3?: Dynamic): Dynamic => input3.toLowerCase());
              if (
                value289.length !== 1 ||
                value289[0] !== context ||
                !(0, runtime.canContainHtmlTag)(value288, value289[0])
              )
                return false;
            }
            return true;
          },
          [],
        ),
        value255: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            input2?: Dynamic,
            options?: Dynamic,
            items?: Dynamic,
            value286?: Dynamic,
          ): Promise<Dynamic> => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            if (!value287 || items.length > 500) return null;
            let value288: Dynamic = await (0, runtime.planPickerDrop)(
                value287,
                input2,
                options.x,
                options.y,
                items,
                value286,
              ),
              value289: Dynamic = (0, runtime.parseGroupMoveSnapshot)(
                value288,
                items.map((input3?: Dynamic): Dynamic => input3.tid),
              );
            if (!value289) return null;
            let value290: Dynamic = (await value159.current.ensureModel(
              value169,
            ))
              ? value170(value169)
              : null;
            if (!value290) return null;
            let items2: Dynamic = [...value289.refused],
              value291: Dynamic = value289.landing.filter(
                (input3?: Dynamic): Dynamic => {
                  let value292: Dynamic =
                      items.find(
                        (input4?: Dynamic): Dynamic =>
                          input4.tid === input3.tid,
                      )?.tag ?? "div",
                    value293: Dynamic = value254(
                      value290.model,
                      input3,
                      value292,
                      null,
                    );
                  value293 || items2.push(input3.tid);
                  return value293;
                },
              );
            return {
              container: value289.container,
              landing: value291,
              refused: items2,
            };
          },
          [value170, value169, value254],
        ),
        value256: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options: Dynamic = false): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 &&
              (0, runtime.clearPickerDropPlan)(value286, input2, options);
          },
          [],
        ),
        value257: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (
            items?: Dynamic,
            items2?: Dynamic,
            context: Dynamic = [],
          ): Promise<Dynamic> => {
            let entries: Dynamic = new Map(),
              value286: Dynamic = null,
              value287: Dynamic = null,
              items3: Dynamic = [],
              value288: Dynamic,
              callback5: Dynamic = (element?: Dynamic): Dynamic =>
                parseInt(element.getAttribute("data-dc-tpl") ?? "-1", 10);
            try {
              value288 = await value159.current.mutate(
                value169,
                (input2?: Dynamic, options?: Dynamic): Dynamic => {
                  if (options.path !== value2) return false;
                  let value289: Dynamic = options.model.serialize();
                  try {
                    let value290: Dynamic = items.map(
                        (input3?: Dynamic): Dynamic =>
                          input3.landing.targetTid == null
                            ? null
                            : options.model.element(input3.landing.targetTid),
                      ),
                      value291: Dynamic =
                        items2.length === 1
                          ? [
                              items2[0].tid,
                              ...(items2[0].followers ?? []).map(
                                (input3?: Dynamic): Dynamic => input3.tid,
                              ),
                              ...(items2[0].group ?? []).map(
                                (input3?: Dynamic): Dynamic => input3.tid,
                              ),
                            ]
                          : [...context],
                      value292: Dynamic = [...new Set(value291)]
                        .map(
                          (input3?: Dynamic): Dynamic =>
                            options.model.element(input3),
                        )
                        .filter((input3?: Dynamic): Dynamic => input3 != null),
                      items4: Dynamic = [];
                    if (items2.length === 1) {
                      let value294: Dynamic = items2[0],
                        value295: Dynamic =
                          value294.block ??
                          (0, runtime.sameParentDropGroup)(
                            options.model,
                            value294.tid,
                            value294.group,
                          ),
                        state2: Dynamic = {
                          ...value294,
                          block:
                            value295 && value295[0] === value294.tid
                              ? value295
                              : null,
                        };
                      if (
                        (0, runtime.elementMoveRefusal)(
                          options.model,
                          state2,
                        ) === "in-place"
                      )
                        value286 = "in-place";
                      else {
                        let value296: Dynamic = (0, runtime.moveModelElement)(
                          options,
                          state2,
                        );
                        value296
                          ? ((value292 = [
                              value296.newTid,
                              ...value296.groupTids.filter(
                                (input3?: Dynamic): Dynamic =>
                                  input3 !== value296.newTid && input3 >= 0,
                              ),
                            ]
                              .map(
                                (input3?: Dynamic): Dynamic =>
                                  options.model.element(input3),
                              )
                              .filter(
                                (input3?: Dynamic): Dynamic => input3 != null,
                              )),
                            (items4 = value296.pins.flatMap(
                              (input3?: Dynamic): Dynamic => {
                                let value297: Dynamic = options.model.element(
                                  input3.tid,
                                );
                                return value297
                                  ? [
                                      {
                                        pin: input3,
                                        el: value297,
                                      },
                                    ]
                                  : [];
                              },
                            )),
                            (value286 = {
                              newTids: [],
                            }))
                          : ((options.model = options.model.rebuild(value289)),
                            (value286 = "refused"),
                            (value292 = [...new Set(value291)]
                              .map(
                                (input3?: Dynamic): Dynamic =>
                                  options.model.element(input3),
                              )
                              .filter(
                                (input3?: Dynamic): Dynamic => input3 != null,
                              )));
                      }
                    } else items2.length > 1 && (value286 = "refused");
                    let entries2: Dynamic = new Map(),
                      value293: Dynamic = null;
                    for (
                      let index: Dynamic = 0;
                      index < items.length;
                      index++
                    ) {
                      let value294: Dynamic = items[index],
                        landing: Dynamic = value294.landing,
                        value295: Dynamic =
                          options.model
                            .topLevelTags(value294.html)[0]
                            ?.toLowerCase() ?? "",
                        value296: Dynamic,
                        value297: Dynamic;
                      if (
                        value293 &&
                        !landing.absolute &&
                        (landing.position === "before" ||
                          landing.position === "after")
                      ) {
                        value296 = callback5(value293);
                        value297 = "after";
                      } else {
                        let value301: Dynamic = value290[index];
                        if (landing.targetTid != null && !value301) continue;
                        value296 = value301 ? callback5(value301) : null;
                        value297 = landing.position;
                      }
                      if (
                        !value254(
                          options.model,
                          {
                            ...landing,
                            targetTid: value296,
                            position: value297,
                          },
                          value295,
                          value294.html,
                        )
                      )
                        continue;
                      let value298: Dynamic = options.model.insertHtml(
                        value294.html,
                        value296,
                        value297,
                      );
                      if (!value298 || value298.length === 0) continue;
                      options.model.restamp();
                      let value299: Dynamic = value298[0],
                        value300: Dynamic = callback5(value299);
                      if (landing.absolute) {
                        options.model.setStyleProperty(
                          value300,
                          "position",
                          "absolute",
                        );
                        for (let [value301, value302] of Object.entries(
                          landing.absStyles ?? {},
                        ) as Dynamic)
                          options.model.setStyleProperty(
                            value300,
                            value301,
                            value302,
                          );
                        landing.parentNeedsPositioning === true &&
                          value296 != null &&
                          !options.model.inlineStyleValue(
                            value296,
                            "position",
                          ) &&
                          options.model.setStyleProperty(
                            value296,
                            "position",
                            "relative",
                          );
                      } else
                        for (let value301 of [
                          "position",
                          "left",
                          "top",
                          "right",
                          "bottom",
                        ] as Dynamic)
                          options.model.inlineStyleValue(value300, value301) &&
                            options.model.setStyleProperty(
                              value300,
                              value301,
                              null,
                            );
                      entries2.set(value294.key, [...value298]);
                      value293 = landing.absolute ? value293 : value299;
                    }
                    if (
                      entries2.size === 0 &&
                      (value286 == null ||
                        value286 === "in-place" ||
                        value286 === "refused")
                    ) {
                      options.model = options.model.rebuild(value289);
                      return false;
                    }
                    for (let [value294, value295] of entries2 as Dynamic)
                      entries.set(
                        value294,
                        value295
                          .map(callback5)
                          .filter((input3?: Dynamic): Dynamic => input3 >= 0),
                      );
                    value286 && typeof value286 == "object"
                      ? (value286.newTids = value292
                          .map(callback5)
                          .filter((input3?: Dynamic): Dynamic => input3 >= 0))
                      : (value286 === "in-place" ||
                          value286 === "refused" ||
                          value286 == null) &&
                        (value287 = value292
                          .map(callback5)
                          .filter((input3?: Dynamic): Dynamic => input3 >= 0));
                    items3 = items4.map(
                      ({ pin: pin2, el: el }: Dynamic): Dynamic => ({
                        ...pin2,
                        tid: callback5(el),
                        el: el,
                      }),
                    );
                    return true;
                  } catch {
                    options.model = options.model.rebuild(value289);
                    return false;
                  }
                },
                {
                  structural: true,
                },
              );
            } catch {
              return "failed";
            }
            if (value288 !== "applied" && value288 !== "applied-dirty")
              return "failed";
            for (let value289 of items3 as Dynamic)
              setTimeout((): Dynamic => {
                value241(value289, false);
              }, 120);
            return {
              landed: entries,
              stayers: value286,
              ...(value287
                ? {
                    stayersOwn: value287,
                  }
                : {}),
            };
          },
          [value169, value2, value241, value254],
        ),
        value258: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (items?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = value170(value169);
            if (!value286) return "refused";
            let value287: Dynamic = items.map(
              (input2?: Dynamic): Dynamic => value286.model.element(input2),
            );
            if (
              value287.some((input2?: Dynamic): Dynamic => input2 == null) ||
              items.some(
                (input2?: Dynamic): Dynamic =>
                  value286.model.isLoopDriven(input2) ||
                  value286.model.isUneditable(input2),
              )
            )
              return "refused";
            let value288: Dynamic = options
                .map(
                  (input2?: Dynamic): Dynamic => value286.model.element(input2),
                )
                .filter((input2?: Dynamic): Dynamic => input2 != null),
              items2: Dynamic = [],
              value289: Dynamic;
            try {
              value289 = await value159.current.mutate(
                value169,
                (input2?: Dynamic, options2?: Dynamic): Dynamic => {
                  if (options2.path !== value2 || options2 !== value286)
                    return false;
                  for (let index: Dynamic = 0; index < items.length; index++)
                    if (
                      options2.model.element(items[index]) !== value287[index]
                    )
                      return false;
                  for (let value290 of items as Dynamic)
                    options2.model.removeElement(value290);
                  options2.model.restamp();
                  items2 = value288
                    .map(
                      (element?: Dynamic): Dynamic =>
                        parseInt(
                          element.getAttribute("data-dc-tpl") ?? "-1",
                          10,
                        ),
                    )
                    .filter((input3?: Dynamic): Dynamic => input3 >= 0);
                  options2.model = options2.model.rebuild(
                    options2.model.serialize(),
                  );
                  return true;
                },
                {
                  structural: true,
                },
              );
            } catch {
              return "failed";
            }
            return value289 === "refused" || value289 === false
              ? "refused"
              : value289 !== "applied" && value289 !== "applied-dirty"
                ? "failed"
                : {
                    kept: items2,
                  };
          },
          [value170, value169, value2],
        ),
        value259: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = value170(value169);
          return value286 ? value286.undo.length : null;
        }, [value170, value169]),
        value260: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = value170(value169);
          return value286 ? (value286.undoFloor ?? 0) : null;
        }, [value170, value169]),
        value261: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)((): Dynamic => {
          let value286: Dynamic = value170(value169);
          return value286 ? value286.redo.length : null;
        }, [value170, value169]),
        value262: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(value169);
            value286 && (0, runtime.trimUndoHistory)(value286, input2);
          },
          [value170, value169],
        ),
        value263: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => {
            let value286: Dynamic = value170(value169),
              value287: Dynamic = value286?.redo;
            if (!value286 || !value287 || value287.length === 0)
              return (): Dynamic => {};
            let value288: Dynamic =
              input2 === undefined ? 0 : input2 - 1 - value286.undo.length;
            if (value288 < 0 || value288 >= value287.length)
              return (): Dynamic => {};
            let value289: Dynamic = value287.slice(value287.length - value288);
            value286.redo = value289;
            return (): Dynamic => {
              value286.redo.length === 0 && (value286.redo = value287);
            };
          },
          [value170, value169],
        ),
        value264: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
          await value159.current.writeNow(value169);
        }, [value169, value2]),
        value265: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = value170(input2);
            if (!value286) return false;
            let length: Dynamic = value286[options].length,
              length2: Dynamic = value286.redo.length,
              model: Dynamic = value286.model,
              value287: Dynamic = (0, runtime.applyElementUndo)(
                value286,
                options,
                {
                  overrides: value160.current.values,
                },
              );
            if (!value287) {
              if (value286[options].length < length) {
                if (options === "undo")
                  for (
                    let length3: Dynamic = value286.redo.length;
                    length3 < length2;
                    length3++
                  )
                    value52?.(value2, "redo");
                value52?.(value2, options);
              }
              return false;
            }
            value50?.(value2, options);
            return value287.kind === "prop" || value287.kind === "script"
              ? (value287.kind === "prop"
                  ? value160.current.setProp(value287.prop, value287.liveValue)
                  : (0, runtime.emitEditorEvent)("dc-update", {
                      name: input2,
                      path: value286.path,
                      kind: "js",
                      content: value287.js,
                      streaming: false,
                      viewportKey: "dc-model",
                    }),
                (value286.dirty = true),
                value167.current
                  ? true
                  : (await value159.current.writeNow(input2)) !== "failed")
              : ((value286.dirty = true),
                value167.current || value159.current.writeNow(input2),
                (value286.stampGen = (value286.stampGen ?? -1) + 1),
                (value286.liveStampsStale = false),
                value159.current.pushLive(input2),
                value131.current.onTemplateRestored?.(input2, model),
                (await value159.current.writeNow(input2)) !== "failed");
          },
          [],
        ),
        value266: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (): Dynamic =>
            value114.current && value108.current && value84.current != null,
          [],
        ),
        value267: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (): Dynamic => value124.current != null || value125.current != null,
          [],
        ),
        value268: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
          let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            ),
            value287: Dynamic = value170(value169);
          if (!value286 || !value287 || !value266()) return {};
          let state2: Dynamic = {};
          try {
            let value288: Dynamic = JSON.parse(
              (0, runtime.getDcPropsJson)(value287.src) ?? "{}",
            );
            if (
              value288 &&
              typeof value288 == "object" &&
              !Array.isArray(value288)
            )
              for (let [value289, value290] of Object.entries(
                value288,
              ) as Dynamic)
                !value289.startsWith("$") &&
                  value290 &&
                  typeof value290 == "object" &&
                  (state2[value289] = value290.default);
          } catch {}
          Object.assign(
            state2,
            value287.pendingProps ?? {},
            value160.current.values,
          );
          return (0, runtime.inspectPickerProps)(value286, state2);
        }, [value266, value170, value169]),
        value269: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
          let value286: Dynamic =
            (await value159.current
              .ensureModel(value169)
              .catch((): Dynamic => null)) ?? value170(value169);
          if (!value286 || value286.path !== value2) return null;
          let value287: Dynamic = value286.model
            .childTids(null)
            .filter(
              (input2?: Dynamic): Dynamic =>
                !runtime.SelectionActionsHelmetScHelmetPattern.test(
                  value286.model.tagName(input2) ?? "",
                ) &&
                !value286.model.isUneditable(input2) &&
                !value286.model.isLoopDriven(input2),
            );
          if (value287.length === 0) return null;
          let value288: Dynamic = value177(value287, {
            bakeProps: true,
            vals: await value268(),
          });
          return value288 ? (0, runtime.unpositionPastedHtml)(value288) : null;
        }, [value170, value169, value177, value268]),
        value270: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic): Promise<Dynamic> => {
            let value286: Dynamic = value170(value169);
            return !value286 ||
              !value286.model.element(input2) ||
              value286.model.isUneditable(input2) ||
              value286.model.isLoopDriven(input2) ||
              (0, runtime.promoteSvgShapeToRoot)(value286.model, input2) !==
                input2
              ? null
              : value177([input2], {
                  bakeProps: true,
                  vals: await value268(),
                });
          },
          [value170, value169, value177, value268],
        ),
        value271: Dynamic = (0,
        runtime.reactCanvasShape.useCallback)(async (): Promise<Dynamic> => {
          let value286: Dynamic = await value159.current.ensureModel(value169);
          return value286 && value286.path === value2
            ? value286.model.serialize()
            : null;
        }, [value169, value2]),
        value272: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
            let flag2: Dynamic = false,
              flag3: Dynamic = false,
              value286: Dynamic;
            try {
              let callback5: Dynamic = (
                  input3?: Dynamic,
                  options2?: Dynamic,
                ): Dynamic => {
                  let callback6: Dynamic = (
                      input4?: Dynamic,
                      options3?: Dynamic,
                    ): Dynamic =>
                      JSON.stringify([
                        input4.tagName(options3),
                        input4.attributes(options3),
                        input4.inlineStyleAttr(options3),
                        Array.from(
                          input4.element(options3)?.childNodes ?? [],
                          (input5?: Dynamic): Dynamic =>
                            input5.nodeType === 3 ? input5.nodeValue : null,
                        ),
                      ]),
                    values: Dynamic = new Set(),
                    items: Dynamic = [];
                  for (
                    let index: Dynamic = 0;
                    index < input3.elementCount();
                    index++
                  ) {
                    let value291: Dynamic = callback6(input3, index),
                      value292: Dynamic = callback6(options2, index);
                    value291 !== value292 &&
                      (values.add(value291), items.push(value292));
                  }
                  return items.some(
                    (input4?: Dynamic): Dynamic => values.has(input4),
                  );
                },
                value287: Dynamic =
                  await value159.current.ensureModel(value169),
                value288: Dynamic = value287?.model.serialize(),
                value289: Dynamic = value287?.model.rebuild(input2),
                value290: Dynamic =
                  value287 != null &&
                  value289 !== undefined &&
                  value287.model.sameSkeleton(value289) &&
                  !callback5(value287.model, value289);
              value286 = await value159.current.mutate(
                value169,
                (input3?: Dynamic, options2?: Dynamic): Dynamic => {
                  if (options2.path !== value2) return false;
                  let value291: Dynamic = options2.model.serialize();
                  if (
                    (options !== undefined && value291 !== options) ||
                    (value290 && value291 !== value288)
                  ) {
                    flag3 = true;
                    return false;
                  }
                  if (value291 === input2) {
                    flag2 = true;
                    return false;
                  }
                  let value292: Dynamic =
                    value289 !== undefined && value291 === value288
                      ? value289
                      : options2.model.rebuild(input2);
                  return value292.serialize() !== input2
                    ? false
                    : ((options2.model = value292), true);
                },
                value290
                  ? {
                      structural: false,
                      pushUndo: true,
                    }
                  : {
                      structural: true,
                    },
              );
            } catch {
              return "failed";
            }
            return flag3
              ? "stale"
              : flag2
                ? "same"
                : value286 === "applied" || value286 === "applied-dirty"
                  ? "applied"
                  : value286 === "refused" || value286 === false
                    ? "refused"
                    : "failed";
          },
          [value169, value2],
        );
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (
          value26(value2, {
            file: value2,
            askTemplate: value271,
            askCommit: value272,
            webviewRef: value84,
            isReady: value266,
            isBlocked: value267,
            rebuild: value140,
            readAttrs: value171,
            listKindOf: value172,
            readInlineStyle: value176,
            ensureModel: value173,
            ensureOutline: value175,
            applyHistory: value265,
            undoDepth: value259,
            undoFloor: value260,
            redoDepth: value261,
            cutUndo: value262,
            dropRedo: value263,
            flushPending: value264,
            hasPendingEdits: (): Dynamic =>
              value159.current.anyDirty() ||
              value159.current.anyWriteInFlight(),
            setTweaks: value166,
            pickAt: value233,
            textTids: value232,
            pickIn: value234,
            setShownSelection: value235,
            clearLabelPart: value236,
            hostDrag: value237,
            cancelBox: value238,
            armedByClick: value239,
            textPlacing: value240,
            moveStart: value242,
            moveMove: value243,
            moveEnd: value246,
            moveCancel: value244,
            moveSettle: value245,
            moveElements: value247,
            stageIsEmpty: value248,
            isFreeCanvas: value249,
            moveHost: value250,
            moveExit: value251,
            moveReturn: value252,
            moveTouch: value253,
            dropPlanAt: value255,
            dropPlanClear: value256,
            landTravellers: value257,
            removeTravelled: value258,
            travellerHtml: value270,
            pieceContent: value269,
            serializeSelection: value177,
            renderDefaults: value268,
            removeSelection: value178,
            duplicateSelection: value179,
            walkTids: value180,
            nudgeSelection: value184,
            flipRead: value185,
            flipSelection: value186,
            insertHtml: value217,
            insertLayerAt: value218,
            swapImageAttrs: value226,
            replaceImageFor: value227,
            toggleCrop: value209,
            replaceVideoFor: value230,
            videoKey: value229,
            videoEl: value228,
            pageFill: value190,
            setPageFill: value192,
            setStylePropsPerTid: value189,
            beginStyleGesture: value194,
            endStyleGesture: value195,
            describeTids: value216,
            viewEntries: value215,
            formatCommand: value220,
            startTextEdit: value221,
            pageFonts: value223,
            holdsDeck: value222,
            pageCensus: value225,
          }),
          (): Dynamic => value26(value2, null)
        ),
        [
          value2,
          value140,
          value171,
          value172,
          value176,
          value173,
          value175,
          value265,
          value259,
          value260,
          value261,
          value262,
          value263,
          value166,
          value233,
          value232,
          value234,
          value235,
          value236,
          value237,
          value238,
          value239,
          value240,
          value242,
          value243,
          value246,
          value244,
          value245,
          value247,
          value248,
          value249,
          value250,
          value251,
          value252,
          value253,
          value255,
          value256,
          value257,
          value258,
          value270,
          value269,
          value177,
          value268,
          value178,
          value179,
          value180,
          value184,
          value185,
          value186,
          value217,
          value218,
          value226,
          value227,
          value209,
          value230,
          value229,
          value228,
          value190,
          value192,
          value189,
          value194,
          value195,
          value216,
          value215,
          value220,
          value223,
          value222,
          value225,
          value271,
          value272,
        ],
      );
      let value273: Dynamic = (0, runtime.reactCanvasShape.useRef)(value26);
      value273.current = value26;
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic => value273.current(value2, null, true),
        [value2],
      );
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value91 > 0 && value28?.(value2, value91);
      }, [value91]);
      let [value274, value275]: Dynamic = (0,
      runtime.reactCanvasShape.useState)(undefined);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value23 && value152((input2?: Dynamic): Dynamic => input2 + 1);
      }, [value23]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (!value29 || value29.length === 0) {
          value275(undefined);
          return;
        }
        if (value91 === 0) return;
        let value286: Dynamic = (0, runtime.createPreviewHandle)(
          value84.current,
        );
        if (value286)
          return (0, runtime.observePickerCssVariables)(
            value286,
            value29,
            (input2?: Dynamic): Dynamic =>
              value275(
                (input3?: Dynamic): Dynamic =>
                  (0, runtime.sameStringSet)(input3, input2) ? input3 : input2,
              ),
          );
      }, [value91, value29, value151]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (
          value30?.(value2, value274),
          (): Dynamic => value30?.(value2, undefined)
        ),
        [value2, value274, value30],
      );
      let value276: Dynamic = value95 != null || value97 != null;
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value31?.(value2, value276);
      }, [value276]);
      let value277: Dynamic = (0, runtime.reactCanvasShape.useRef)(value32);
      value277.current = value32;
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value277.current?.(
          value2,
          (0, runtime.artboardLoadErrorMessages)(value97, value95, value99),
        );
      }, [value2, value97, value95, value99]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic =>
          value277.current?.(value2, runtime.emptyArtboardErrors),
        [value2],
      );
      let value278: Dynamic = value137 && !value23 && value78,
        value279: Dynamic = (value23 === true || value278 === true) && value106;
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        value102.current?.(null);
      }, [value93]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (!value279) return;
        let value286: Dynamic = (0, runtime.createPreviewHandle)(
          value84.current,
        );
        value286 && (0, runtime.repostPickerChrome)(value286);
      }, [value279, value82]);
      let callback2: Dynamic = (event?: Dynamic): Dynamic => {
          if (!value77 || !value8) return;
          let value286: Dynamic = (0, runtime.createPreviewHandle)(
            value84.current,
          );
          if (!value286) return;
          event.preventDefault();
          event.stopPropagation();
          let bounds: Dynamic = value77.getBoundingClientRect(),
            value287: Dynamic = bounds.width > 0 ? bounds.width / value8.w : 1;
          (0, runtime.pickerContextMenuAt)(
            value286,
            (event.clientX - bounds.left) / value287,
            (event.clientY - bounds.top) / value287,
          );
        },
        value280: Dynamic = (0, runtime.reactCanvasShape.useRef)(false),
        callback3: Dynamic = (
          items?: Dynamic,
          options?: Dynamic,
          context?: Dynamic,
        ): Dynamic => {
          let current: Dynamic = value198.current,
            value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            ),
            current2: Dynamic = value103.current;
          if (
            !current ||
            !value286 ||
            !current2 ||
            !value77 ||
            !value8 ||
            value280.current ||
            !value210() ||
            !(0, runtime.canStartCanvasDrag)(options)
          )
            return true;
          options.stopPropagation();
          value280.current = true;
          try {
            options.currentTarget.setPointerCapture(options.pointerId);
          } catch {}
          value9?.("element-crop", true);
          let [items2, items3, items4, items5]: Dynamic = [
              options.pointerId,
              options.clientX,
              options.clientY,
              value77,
            ],
            callback5: Dynamic = (): Dynamic => {
              let bounds: Dynamic = items5.getBoundingClientRect();
              return bounds.width > 0 ? bounds.width / value8.w : 1;
            },
            callback6: Dynamic = (
              input2?: Dynamic,
              options2?: Dynamic,
            ): Dynamic => {
              let bounds: Dynamic = items5.getBoundingClientRect();
              return {
                x: (input2 - bounds.left) / callback5(),
                y: (options2 - bounds.top) / callback5(),
              };
            },
            value287: Dynamic = callback6(items3, items4),
            {
              frame: value288,
              natural: value289,
              rot: value290,
            }: Dynamic = context,
            [items6, items7, items8]: Dynamic = [
              current.live,
              (0, runtime.MediaObjectCropSupports)(),
              current.tid,
            ],
            callback7: Dynamic = (): Dynamic =>
              value198.current === current && value201() === items8,
            [items9, items10]: Dynamic = [
              current2.w - value288.w,
              current2.h - value288.h,
            ],
            callback8: Dynamic = (
              input2?: Dynamic,
              options2?: Dynamic,
            ): Dynamic => {
              let value294: Dynamic =
                  input2.includes("e") || input2.includes("w")
                    ? Math.max(1, Math.round(options2.w + items9) - items9)
                    : value288.w,
                value295: Dynamic =
                  input2.includes("n") || input2.includes("s")
                    ? Math.max(1, Math.round(options2.h + items10) - items10)
                    : value288.h;
              return {
                x: input2.includes("w") ? value288.w - value294 : 0,
                y: input2.includes("n") ? value288.h - value295 : 0,
                w: value294,
                h: value295,
              };
            },
            callback9: Dynamic = (input2?: Dynamic): Dynamic =>
              callback8(items, input2),
            { autoW: value291, autoH: value292 }: Dynamic =
              current2.media ?? {},
            value293: Dynamic =
              items.length === 2
                ? items
                : items === "e"
                  ? value292
                    ? "se"
                    : "e"
                  : items === "w"
                    ? value292
                      ? "sw"
                      : "w"
                    : items === "s"
                      ? value291
                        ? "se"
                        : "s"
                      : value291
                        ? "ne"
                        : "n";
          (0, runtime.registerElementSession)(value169, current.el);
          (0, runtime.pickerGesturePhase)(value286, {
            phase: "start",
            kind: "resize",
            dir: value293,
            x: value287.x,
            y: value287.y,
          });
          let [items11, items12, items13]: Dynamic = [false, false, false],
            callback10: Dynamic = (
              input2?: Dynamic,
              options2?: Dynamic,
            ): Dynamic =>
              Object.fromEntries(
                (0, runtime.imageCropStyleEdits)(
                  options2,
                  value289,
                  input2,
                ).map(
                  ([input3, input4]: Dynamic): Dynamic => [
                    input3,
                    input4 ?? "none",
                  ],
                ),
              ),
            callback11: Dynamic = (
              input2?: Dynamic,
              options2?: Dynamic,
            ): Dynamic => {
              current.live = input2;
              current.at = {
                frame: options2,
                natural: value289,
              };
              value197(
                (input3?: Dynamic): Dynamic =>
                  input3 && {
                    ...input3,
                    live: input2,
                  },
              );
            },
            callback12: Dynamic = (input2?: Dynamic): Dynamic => {
              if (
                input2.pointerId !== items2 ||
                (!items11 &&
                  Math.hypot(input2.clientX - items3, input2.clientY - items4) <
                    4)
              )
                return;
              if (!callback7()) return callback13(false);
              items11 = true;
              let value294: Dynamic = callback6(input2.clientX, input2.clientY),
                [items14, items15, items16, items17]: Dynamic = [
                  value294.x - value287.x,
                  value294.y - value287.y,
                  Math.cos(value290),
                  Math.sin(value290),
                ],
                [items18, items19, items20]: Dynamic = [
                  items14 * items16 + items15 * items17,
                  items15 * items16 - items14 * items17,
                  Math.max(16 / callback5(), 8),
                ],
                callback18: Dynamic = (input3?: Dynamic): Dynamic =>
                  !items7 && input3.zoom > Math.max(1, items6.zoom) + 0.001,
                value295: Dynamic = (0, runtime.resizeImageCropFrame)(
                  value288,
                  value289,
                  items6,
                  items,
                  items18,
                  items19,
                  items20,
                ),
                value296: Dynamic = callback9(value295.frame),
                value297: Dynamic = (0, runtime.cropIntoFrame)(
                  value288,
                  value289,
                  items6,
                  value296,
                );
              for (let value301 of (callback18(value297) && items.length === 2
                ? [items[1], items[0]]
                : []) as Dynamic) {
                let value302: Dynamic = (0, runtime.resizeImageCropFrame)(
                    value288,
                    value289,
                    items6,
                    value301,
                    items18,
                    items19,
                    items20,
                  ),
                  [items21, items22]: Dynamic = [
                    callback8(value301, value302.frame),
                    (0, runtime.cropIntoFrame)(
                      value288,
                      value289,
                      items6,
                      callback8(value301, value302.frame),
                    ),
                  ];
                if (!callback18(items22)) {
                  [value295, value296, value297] = [value302, items21, items22];
                  break;
                }
              }
              let value298: Dynamic =
                (value296.w < current.at.frame.w ||
                  value296.h < current.at.frame.h) &&
                (0, runtime.MediaObjectCropZoom)(
                  {
                    w: value296.w,
                    h: value296.h,
                  },
                  value289,
                  value297,
                );
              if (callback18(value297) || value298) {
                items12 ||
                  (0, runtime.announce)(
                    callback18(value297)
                      ? runtime.ThisBrowserCanTZoomAPictureMessage
                      : runtime.YouCanTCropAnyFurtherAtMessage,
                  );
                items12 = true;
                return;
              }
              let value299: Dynamic = items.includes("e")
                  ? value295.frame.w - value288.w
                  : items.includes("w")
                    ? value295.frame.x
                    : 0,
                value300: Dynamic = items.includes("s")
                  ? value295.frame.h - value288.h
                  : items.includes("n")
                    ? value295.frame.y
                    : 0;
              (0, runtime.resizePickerSelection)(
                value286,
                callback10(value297, value296),
              );
              items13 = true;
              (0, runtime.pickerGesturePhase)(value286, {
                phase: "move",
                kind: "resize",
                x: value287.x + value299 * items16 - value300 * items17,
                y: value287.y + value299 * items17 + value300 * items16,
                shift: false,
              });
              callback11(value297, {
                w: value296.w,
                h: value296.h,
              });
            },
            callback13: Dynamic = (input2?: Dynamic): Dynamic => {
              (window as Dynamic).removeEventListener(
                "pointermove",
                callback12,
              );
              (window as Dynamic).removeEventListener("pointerup", callback14);
              (window as Dynamic).removeEventListener(
                "pointercancel",
                callback15,
              );
              (window as Dynamic).removeEventListener("blur", callback17);
              (window as Dynamic).removeEventListener(
                "keydown",
                callback16,
                true,
              );
              value280.current = false;
              value9?.("element-crop", false);
              (0, runtime.unregisterElementSession)(
                value169,
                current.el,
                items13,
              );
              let value294: Dynamic =
                input2 &&
                items11 &&
                callback7() &&
                (Math.abs(current.at.frame.w - value288.w) >= 0.5 ||
                  Math.abs(current.at.frame.h - value288.h) >= 0.5);
              if (value294) {
                let value295: Dynamic = (0, runtime.normalizeStyleEdits)(
                    (0, runtime.imageCropStyleEdits)(
                      current.at.frame,
                      value289,
                      current.live,
                    ),
                  ),
                  value296: Dynamic = JSON.stringify(value295),
                  value297: Dynamic = value203(current.el);
                (0, runtime.registerLateGesture)(value169, items8, {
                  el: current.el,
                  edits: value295,
                  lapsed: (input3?: Dynamic): Dynamic => {
                    if (input3 === "stale") return void (current.wrote = "");
                    value198.current === current
                      ? ((current.wrote = ""),
                        callback7() &&
                          (0, runtime.patchPickerStyle)(
                            value286,
                            value169,
                            [current.tid],
                            callback10(current.live, current.at.frame),
                            current.token,
                          ))
                      : current.closed === "held" &&
                        current.wrote === value296 &&
                        value202.current.get(current.el) === value297 &&
                        value205.current(current.el, value295);
                  },
                });
                current.wrote = value296;
              } else
                items11 &&
                  value198.current === current &&
                  callback11(items6, value288);
              (0, runtime.pickerGesturePhase)(value286, {
                phase: "end",
                kind: "resize",
                commit: value294,
              });
              callback7() &&
                (0, runtime.holdPickerStyle)(
                  value286,
                  value169,
                  [current.tid],
                  callback10(current.live, current.at.frame),
                  current.token,
                );
            },
            callback14: Dynamic = (input2?: Dynamic): Dynamic => {
              input2.pointerId === items2 && callback13(true);
            },
            callback15: Dynamic = (input2?: Dynamic): Dynamic => {
              input2.pointerId === items2 && callback13(false);
            },
            callback16: Dynamic = (event?: Dynamic): Dynamic => {
              /^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|NumLock)$/.test(
                event.key,
              ) ||
                (event.preventDefault(),
                event.stopImmediatePropagation(),
                event.key === "Escape" && callback13(false));
            },
            callback17: Dynamic = (): Dynamic => callback13(true);
          (window as Dynamic).addEventListener("pointermove", callback12);
          (window as Dynamic).addEventListener("pointerup", callback14);
          (window as Dynamic).addEventListener("pointercancel", callback15);
          (window as Dynamic).addEventListener("blur", callback17);
          (window as Dynamic).addEventListener("keydown", callback16, true);
          return true;
        },
        value281: Dynamic = (0, runtime.reactCanvasShape.useRef)(callback3);
      value281.current = callback3;
      let value282: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 &&
              (0, runtime.pickerPenPreview)(value286, input2, options);
          },
          [],
        ),
        value283: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic => {
            let value286: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value286 &&
              (0, runtime.pickerVectorPreview)(
                value286,
                input2,
                options,
                context,
              );
          },
          [],
        ),
        value284: Dynamic = (0, runtime.reactCanvasShape.useCallback)(
          (input2?: Dynamic): Dynamic => value9?.("element-grip", input2),
          [value9],
        ),
        callback4: Dynamic = (source?: Dynamic, options?: Dynamic): Dynamic => {
          if (value280.current || !value77 || !value8) return;
          let value286: Dynamic = (0, runtime.createPreviewHandle)(
            value84.current,
          );
          if (!value286 || !(0, runtime.canStartCanvasDrag)(options)) return;
          (0, runtime.focusCanvasDocument)();
          options.stopPropagation();
          value280.current = true;
          let currentTarget: Dynamic = options.currentTarget;
          try {
            currentTarget.setPointerCapture(options.pointerId);
          } catch {}
          value9?.("element-grip", true);
          let pointerId: Dynamic = options.pointerId,
            clientX: Dynamic = options.clientX,
            clientY: Dynamic = options.clientY,
            value287: Dynamic = value77,
            callback5: Dynamic = (
              input2?: Dynamic,
              options2?: Dynamic,
            ): Dynamic => {
              let bounds: Dynamic = value287.getBoundingClientRect(),
                value289: Dynamic =
                  bounds.width > 0 ? bounds.width / value8.w : 1;
              return {
                x: (input2 - bounds.left) / value289,
                y: (options2 - bounds.top) / value289,
              };
            },
            value288: Dynamic = callback5(clientX, clientY);
          (0, runtime.pickerGesturePhase)(value286, {
            phase: "start",
            ...source,
            x: value288.x,
            y: value288.y,
          });
          let flag2: Dynamic = false,
            callback6: Dynamic = (input2?: Dynamic): Dynamic => {
              if (
                input2.pointerId !== pointerId ||
                (!flag2 &&
                  Math.hypot(
                    input2.clientX - clientX,
                    input2.clientY - clientY,
                  ) < 4)
              )
                return;
              flag2 = true;
              let value289: Dynamic = callback5(input2.clientX, input2.clientY);
              (0, runtime.pickerGesturePhase)(value286, {
                phase: "move",
                kind: source.kind,
                x: value289.x,
                y: value289.y,
                shift: input2.shiftKey,
              });
            },
            callback7: Dynamic = (input2?: Dynamic): Dynamic => {
              if (!(input2.pointerId !== pointerId || !value280.current))
                try {
                  value287.setPointerCapture(pointerId);
                } catch {}
            };
          (document as Dynamic).addEventListener(
            "lostpointercapture",
            callback7,
            true,
          );
          let callback8: Dynamic = (input2?: Dynamic): Dynamic => {
              (window as Dynamic).removeEventListener("pointermove", callback6);
              (window as Dynamic).removeEventListener("pointerup", callback9);
              (window as Dynamic).removeEventListener(
                "pointercancel",
                callback10,
              );
              (window as Dynamic).removeEventListener(
                "keydown",
                callback11,
                true,
              );
              (document as Dynamic).removeEventListener(
                "lostpointercapture",
                callback7,
                true,
              );
              value280.current = false;
              value9?.("element-grip", false);
              (0, runtime.pickerGesturePhase)(value286, {
                phase: "end",
                kind: source.kind,
                commit: input2,
              });
            },
            callback9: Dynamic = (input2?: Dynamic): Dynamic => {
              input2.pointerId === pointerId && callback8(flag2);
            },
            callback10: Dynamic = (input2?: Dynamic): Dynamic => {
              input2.pointerId === pointerId && callback8(false);
            },
            callback11: Dynamic = (event?: Dynamic): Dynamic => {
              event.key === "Escape" &&
                (event.preventDefault(),
                event.stopImmediatePropagation(),
                callback8(false));
            };
          (window as Dynamic).addEventListener("pointermove", callback6);
          (window as Dynamic).addEventListener("pointerup", callback9);
          (window as Dynamic).addEventListener("pointercancel", callback10);
          (window as Dynamic).addEventListener("keydown", callback11, true);
        };
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (value158 === 0) return;
        let value286: Dynamic = (0, runtime.createPreviewHandle)(
          value84.current,
        );
        if (value286) {
          (0, runtime.setPickerRingsOnly)(value286, value278);
          return (): Dynamic => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value287 && (0, runtime.setPickerRingsOnly)(value287, false);
          };
        }
      }, [value278, value158, value91]);
      (0, runtime.reactCanvasShape.useEffect)(
        (): Dynamic => (): Dynamic =>
          (0, runtime.updateDropGhostDemand)(value2, 0),
        [value2],
      );
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (value158 === 0 || !value137) return;
        let callback5: Dynamic = (): Dynamic => {
          let value286: Dynamic = (0, runtime.createPreviewHandle)(
            value84.current,
          );
          value286 &&
            (0, runtime.setPickerHiddenTags)(
              value286,
              (0, runtime.getHiddenPickerTags)(),
            );
        };
        callback5();
        return (0, runtime.subscribeHiddenPickerTags)(callback5);
      }, [value137, value158, value91]);
      (0, runtime.reactCanvasShape.useEffect)((): Dynamic => {
        if (!value23 || value158 === 0) return;
        let callback5: Dynamic = (input2?: Dynamic): Dynamic => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value287 && (0, runtime.setPickerMeasure)(value287, input2);
          },
          callback6: Dynamic = (input2?: Dynamic): Dynamic => {
            let value287: Dynamic = (0, runtime.createPreviewHandle)(
              value84.current,
            );
            value287 && (0, runtime.setPickerDeepSelection)(value287, input2);
          },
          callback7: Dynamic = (input2?: Dynamic): Dynamic => {
            input2.key === "Alt" &&
              !input2.repeat &&
              callback5(input2.type === "keydown");
          },
          callback8: Dynamic = (): Dynamic => {
            (document as Dynamic).hasFocus() || callback5(false);
          };
        (window as Dynamic).addEventListener("keydown", callback7, true);
        (window as Dynamic).addEventListener("keyup", callback7, true);
        (window as Dynamic).addEventListener("blur", callback8);
        let value286: Dynamic = (0, runtime.subscribePrimaryModifierHeld)(
          callback6,
        );
        (0, runtime.getPrimaryModifierHeld)() && callback6(true);
        return (): Dynamic => {
          (window as Dynamic).removeEventListener("keydown", callback7, true);
          (window as Dynamic).removeEventListener("keyup", callback7, true);
          (window as Dynamic).removeEventListener("blur", callback8);
          value286();
          callback5(false);
          callback6(false);
        };
      }, [value23, value158, value91]);
      let value285: Dynamic = value23 ? (
        <runtime.DesignEditorSession
          webviewRef={value84}
          projectPath={"appifact"}
          filePath={value2}
          exportTitle={value4}
          active={true}
          readOnly={value83}
          canvasTools={!flag}
          installGen={value158}
          iframeDefinedVars={value274}
          modeOverride={"pro"}
          actionsRef={value55}
          dcProps={value148}
          tweaksProps={state}
          dcModel={value157}
          dcModelCbRef={value131}
          exitGuardRef={value33}
          textEditOpenRef={value34}
          onFrameFree={value146}
          settleSessionRef={value35}
          commitOpenTextEditRef={value36}
          onSessionDirtyChange={value37}
          onEditInput={value38 ? (): Dynamic => value38(value2) : undefined}
          onUndoStack={value40}
          onToolChange={value41}
          toolResetTick={value42}
          onHistoryPush={value48 ? (): Dynamic => value48(value2) : undefined}
          onHistoryApply={
            value50
              ? (input2?: Dynamic): Dynamic => value50(value2, input2)
              : undefined
          }
          onHistoryRevoke={value51 ? (): Dynamic => value51(value2) : undefined}
          onHistoryDrop={value165}
          onOpenFile={value43}
          onPasteImages={
            value44 &&
            ((input2?: Dynamic, options?: Dynamic): Dynamic =>
              value44(value2, input2, options))
          }
          onDropVideos={
            value45 &&
            ((input2?: Dynamic, options?: Dynamic): Dynamic =>
              value45(value2, input2, options))
          }
          onPointerPresence={
            value46 && ((input2?: Dynamic): Dynamic => value46(value2, input2))
          }
          onPointerAt={
            value47 && ((input2?: Dynamic): Dynamic => value47(value2, input2))
          }
          onTextEditEnded={value60 && ((): Dynamic => value60(value2))}
          routeForwardedKey={value16}
          artboardSettings={value62}
          canvasObject={value63}
          outlineArtboards={value64}
          presentPropsTick={value65}
          onPresentPropsHandled={value66}
          placeRequest={value67}
          onPlaceHandled={value68}
          insertAtPoint={value219}
        />
      ) : null;
      return value97 != null || value95 != null ? (
        <div
          className={
            "absolute inset-0 z-[15] flex items-center justify-center bg-danger p-4 text-center text-sm text-danger"
          }
          title={
            (0, runtime.artboardLoadErrorMessage)(value97, value95) ?? undefined
          }
        >
          {"An error occurred"}
        </div>
      ) : (
        <runtime.jsx_ip.Fragment>
          {value8 && value148.hasProps && value71 && flag && (
            <runtime.ViewportScaleThreshold
              min={runtime.selectionChromeMinimumScale}
            >
              {(input2?: Dynamic): Dynamic => (
                <runtime.ArtboardTweaksRow
                  file={value2}
                  dcProps={state}
                  width={value8.w}
                  interactive={input2 && value70 && value106}
                  keyboardInert={value80}
                  readonly={!value137}
                  onOpenTweaks={value12}
                />
              )}
            </runtime.ViewportScaleThreshold>
          )}
          {false}
          {value70 && value24 && value88 != null && value126 && (
            <iframe
              key={value93}
              ref={value130}
              title={value2}
              aria-label={value3}
              tabIndex={
                (value61 && !value71 && !value72) || value80 ? -1 : undefined
              }
              inert={value81 ? true : undefined}
              sandbox={"allow-scripts allow-same-origin"}
              srcDoc={value88}
              onLoad={(): Dynamic => {
                let value286: Dynamic = value86?.boot;
                if (value286 != null && value89.current !== value93) {
                  value89.current = value93;
                  value84.current?.contentWindow?.postMessage(
                    {
                      __dc_doc: 1,
                      doc: value286.doc,
                      parts: value286.parts,
                      urls: value286.urls,
                    },
                    "*",
                  );
                  return;
                }
                (0, runtime.setPreviewProjectRoot)(
                  value84.current?.contentWindow,
                  value86?.projectRoot === undefined
                    ? undefined
                    : new URL(value86.projectRoot).pathname,
                );
                let value287: Dynamic = value85.frameLoaded();
                if (value287.kind === "foreign") {
                  value142() ||
                    (value96(value85.blocked),
                    (0, runtime.unblockDesignFramesReady)());
                  return;
                }
                (async (): Promise<Dynamic> => {
                  let value288: Dynamic = await value85.waitForHello(),
                    value289: Dynamic =
                      value288 == null
                        ? "dead"
                        : await (0, runtime.probePreviewRuntime)(value288, {
                            attempts: 3,
                          });
                  if (!(value287.gen <= value123.current)) {
                    value85.verdict(value287.gen, value289);
                    if (value85.blocked != null) {
                      value142() ||
                        (value96(value85.blocked),
                        (0, runtime.unblockDesignFramesReady)());
                      return;
                    }
                    value90.current = value287.gen;
                    value287.gen === value113.current &&
                      value101.current !== value287.gen &&
                      value100(runtime.emptyArtboardErrors);
                    !(
                      (0, runtime.isFrameCaptureDocument)() &&
                      !value135 &&
                      (await (0, runtime.createPreviewHandle)(
                        value84.current,
                      )?.awaitSettled({
                        capMs: 1200,
                        finishAnimations: true,
                      }),
                      value287.gen !== value85.mountedGeneration)
                    ) &&
                      (value107(true),
                      value92((input2?: Dynamic): Dynamic => input2 + 1),
                      (0, runtime.refreshDesktopRendering)(value84.current),
                      value135 || (0, runtime.markDesignFramesReady)());
                  }
                })();
              }}
              className={"min-h-0 w-full flex-1 border-0"}
              style={{
                display: "block",
                pointerEvents: value79 ? "none" : undefined,
              }}
            />
          )}
          {value70 && (!value24 || value88 == null || !value106) && (
            <div
              data-testid={"mega-artboard-loading"}
              className={
                "absolute inset-0 z-10 flex items-center justify-center bg-om-bg-canvas"
              }
            >
              {!value74 && (
                <span className={"text-xs text-fg-muted"}>
                  {"Loading\u2026"}
                </span>
              )}
            </div>
          )}
          {value285}
          <ArtboardSelectionChrome
            slot={value77}
            live={value279}
            interactive={value23 === true && value137 === true}
            onGripDown={callback4}
            onContextMenu={callback2}
            sinkRef={value102}
            crop={value214}
            onPenPreview={value282}
            onPenCommit={value283}
            onPenGesture={value284}
            vectorEdit={value69}
            board={(0, runtime.artboardContentSizeDescriptor)(
              value8,
              value75,
              value76,
            )}
          />
        </runtime.jsx_ip.Fragment>
      );
    });
  };
}
