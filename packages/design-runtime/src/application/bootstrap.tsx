/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installApplicationBootstrap(
  runtime: RuntimeBindings,
): () => void {
  var bootstrapJsxRuntime: Dynamic;
  var EMPTY_BOOT_CONTENT: Dynamic;
  var fetchArtifactFile: Dynamic;
  function bootstrapArtifactApplication(options: Dynamic = {}): Dynamic {
    (0, runtime.applyDocumentCdsTheme)(document);
    let startedAt: Dynamic = performance.now(),
      value: Dynamic,
      value2: Dynamic;
    (window as Dynamic).addEventListener(
      "message",
      function value14(input?: Dynamic): Dynamic {
        let data: Dynamic = input.data;
        data !== null &&
          typeof data == "object" &&
          "__frame_size_poke" in data &&
          ((window as Dynamic).removeEventListener("message", value14),
          (value = performance.now()),
          value2?.());
      },
    );
    let value3: Dynamic =
        options.document !== undefined ? null : (0, runtime.getEmbedContext)(),
      flag: Dynamic = false,
      callback: Dynamic = (): Dynamic => flag,
      callback2: Dynamic = (): Dynamic =>
        (0, runtime.fetchPublishedFileIndex)(fetchArtifactFile).catch(
          (): Dynamic => ({
            files: undefined,
            narrowed: false,
          }),
        ),
      value4: Dynamic = callback2().then(
        (input?: Dynamic): Dynamic => ((flag = input.narrowed), input.files),
      ),
      value5: Dynamic =
        options.tree === undefined || options.document !== undefined
          ? null
          : options
              .tree({
                get: fetchArtifactFile,
                listing: value4,
                narrowed: callback,
                embedded: value3 !== null,
              })
              .catch((): Dynamic => null),
      value6: Dynamic =
        options.document === undefined
          ? null
          : options.document({
              get: fetchArtifactFile,
              listing: value4,
              narrowed: callback,
            });
    value6?.catch((): Dynamic => {});
    function value7(input?: Dynamic, options2: Dynamic = 0): Dynamic {
      let value14: Dynamic = [3e3, 15e3, 6e4][options2];
      value14 !== undefined &&
        setTimeout((): Dynamic => {
          callback2().then((input2?: Dynamic): Dynamic => {
            input2.files !== undefined &&
              (0, runtime.setPublishedFileReferences)(input2.files);
            (input2.files === undefined || (input2.narrowed && input)) &&
              ((0, runtime.clearPendingFileOverlay)(),
              value7(input, options2 + 1));
          });
        }, value14);
    }
    async function value8(): Promise<Dynamic> {
      let value14: Dynamic =
        value6 !== null
          ? null
          : Promise.all([
              (0, runtime.getRealtimeDatabaseAdapter)(),
              (0, runtime.resolveDesignWriteAccess)(),
            ]);
      value14?.catch((): Dynamic => {});
      let value15: Dynamic = value5 === null ? null : await value5;
      if (value15 !== null)
        try {
          return value15(
            value14 !== null
              ? (await value14)[1]
              : await (0, runtime.resolveDesignWriteAccess)(),
          );
        } catch (value16: Dynamic) {
          console.error(
            "design: this canvas\u2019s files document could not be built",
            value16,
          );
          let value17: Dynamic =
            value16 instanceof Error ? value16.message : String(value16);
          (0, runtime.completeThumbnailAfterPromise)();
          runtime.healthReporter.report("render", "failure", "internal");
          return {
            doc: (0, runtime.createDesignDocumentStore)({
              ...(0, runtime.logFilesBootstrapError)({
                state: {},
                origin: "failed",
                error: value17,
              }),
              embeddedState: (0, runtime.createErrorDocumentState)(
                runtime.CANVAS_LOAD_ERROR_TITLE,
                "Reload to try again.",
              ),
            }),
            census: null,
          };
        }
      if (value6 !== null)
        try {
          return {
            ...(await value6)(),
            census: null,
          };
        } catch (value16: Dynamic) {
          console.error(
            "design: this canvas\u2019s document could not be built",
            value16,
          );
          let value17: Dynamic =
            value16 instanceof Error ? value16.message : String(value16);
          (0, runtime.completeThumbnailAfterPromise)();
          runtime.healthReporter.report("render", "failure", "internal");
          return {
            doc: (0, runtime.createDesignDocumentStore)({
              ...(0, runtime.logFilesBootstrapError)({
                state: {},
                origin: "failed",
                error: value17,
              }),
              embeddedState: (0, runtime.createErrorDocumentState)(
                runtime.CANVAS_LOAD_ERROR_TITLE,
                "Reload to try again.",
              ),
            }),
            census: null,
          };
        }
      let callback3: Dynamic = (input?: Dynamic): Dynamic => (
        (0, runtime.setFileReferenceStore)(undefined),
        (0, runtime.initializeDatabaseThumbnail)(),
        (0, runtime.setCanvasLoadFailure)(
          input ?? runtime.SIGN_IN_REQUIRED_REASON,
        ),
        {
          doc: (0, runtime.createDesignDocumentStore)(
            (0, runtime.createEmbeddedReadonlyState)(EMPTY_BOOT_CONTENT, input),
          ),
          census: null,
        }
      );
      try {
        let [value16, value17]: Dynamic = await value14;
        if (value16 === null) return callback3();
        if ((0, runtime.hasInvalidEmbedContext)())
          return callback3(
            "This canvas was embedded without valid options; it cannot reach its store here.",
          );
        let value18: Dynamic =
          value3 !== null
            ? (0, runtime.prefixDocumentStore)(value16, value3.storePrefix)
            : value16;
        (0, runtime.setFileReferenceStore)(
          value17.canWrite ? value18 : undefined,
        );
        let value19: Dynamic = await value4;
        (0, runtime.setPublishedFileReferences)(value19 ?? null);
        (value19 === undefined || (flag && value17.canWrite)) &&
          ((0, runtime.clearPendingFileOverlay)(), value7(value17.canWrite));
        let callback4: Dynamic = (input?: Dynamic): Dynamic => {
          let value20: Dynamic = value17.canWrite && input === undefined;
          value20 || (0, runtime.setFileReferenceStore)(undefined);
          let value21: Dynamic = (0, runtime.createLiveDocument)({
            codec: runtime.designDocumentStorageAdapter,
            parseContent: runtime.parseDesignContent,
            initialContent: EMPTY_BOOT_CONTENT,
            defaultTitle: (document as Dynamic).title || "Design",
            db: value18,
            canWrite: value20,
            readOnlyReason: input ?? value17.reason,
            holdRemote: (input2?: Dynamic): Dynamic =>
              input2 === (0, runtime.currentEditingArtboardPath)(),
            onStoreUnavailable: (input2?: Dynamic): Dynamic => {
              console.warn(
                "design: live sync unavailable in this view \u2014 " + input2,
              );
              value9
                ? value9(callback3())
                : (value10 = (): Dynamic => callback3());
            },
            onNotice: (input2?: Dynamic): Dynamic =>
              (0, runtime.showEditorToast)(input2),
          });
          if (value3 === null && !(0, runtime.isFrameCaptureDocument)()) {
            value21.subscribe((): Dynamic => {
              value21.dirty() && (0, runtime.PlatformMigrationStateNow)();
            });
            (0, runtime.whenDocumentLive)(value21, (): Dynamic => {
              (0, runtime.markMigrationLoaded)();
              let value22: Dynamic = (0, runtime.getTombstoneAction)({
                tombstone: (0, runtime.isMovedToFiles)(),
                deadStore: input !== undefined,
                canWrite: value17.canWrite,
              });
              value22 !== "nothing" &&
                (0, runtime.setCanvasLoadFailure)(
                  runtime.CouldnTLoadThisCanvasReloadToMessage,
                );
              value22 !== "nothing" &&
                (0, runtime.showEditorActionToast)(
                  runtime.CouldnTOpenTheCurrentVersionOfMessage,
                  null,
                );
              if (value22 === "reopen-read-only-and-tell") {
                let value23: Dynamic = callback4(
                  runtime.CouldnTOpenTheCurrentVersionOfMessage,
                );
                value21.dispose?.();
                value9 ? value9(value23) : (value10 = (): Dynamic => value23);
              }
              (0, runtime.isMovedToFiles)() ||
                (value20 &&
                  options.afterStoreLive !== undefined &&
                  options
                    .afterStoreLive({
                      get: fetchArtifactFile,
                      listing: value4,
                      narrowed: callback,
                      doc: value21,
                    })
                    .catch((): Dynamic => {}));
            });
            let callback5: Dynamic = (): Dynamic => {
              if (!value17.canWrite || input !== undefined) return;
              if (value21.dirty())
                return void (window as Dynamic).setTimeout(callback5, 500);
              let value22: Dynamic = callback4(
                runtime.ThisCanvasNowSavesInAMessage,
              );
              value21.dispose?.();
              value9 ? value9(value22) : (value10 = (): Dynamic => value22);
            };
            input === undefined &&
              (0, runtime.subscribeMigrationRestart)(callback5);
            (0, runtime.subscribeMovedToFiles)((): Dynamic => {
              input === undefined &&
                (value21.flushNow(),
                (0, runtime.installMigrationRestartHandler)({
                  isTyping: (): Dynamic =>
                    (0, runtime.PlatformMigrationStateNow_2)(),
                  flush: (): Dynamic => value21.flushNow(),
                  drained: (): Dynamic => !value21.dirty(),
                  ...((0, runtime.currentEditingArtboard)() !== null
                    ? {
                        focus: (0, runtime.currentEditingArtboard)(),
                      }
                    : {}),
                }));
            });
          }
          (0, runtime.monitorDocumentLoadHealth)(
            value21,
            (input2?: Dynamic): Dynamic =>
              runtime.healthReporter.report(...input2),
          );
          (0, runtime.monitorDocumentSaveHealth)(
            value21,
            (input2?: Dynamic): Dynamic =>
              runtime.healthReporter.report(...input2),
          );
          (0, runtime.watchThumbnailDocumentReady)(value21, {
            whenPainted: (): Dynamic =>
              (0, runtime.waitForDesignProjectFrames)(value21.content()).then(
                (): Dynamic => (0, runtime.waitForThumbnailPaint)(),
              ),
          });
          return {
            doc: value21,
            census: {
              canWrite: value20,
              capture: (0, runtime.isFrameCaptureDocument)(),
              embedded: value3 !== null,
            },
          };
        };
        return callback4();
      } catch (value16: Dynamic) {
        console.error("design: live store boot failed", value16);
        runtime.healthReporter.report(
          ...runtime.ExportOutcomesRenderFailureInternalValues,
        );
        return callback3("Live sync is unavailable here. Reload to retry.");
      }
    }
    let value9: Dynamic, value10: Dynamic;
    function value11(input?: Dynamic): Dynamic {
      (0, runtime.setHtmlReferenceStore)({
        hydrate: (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          input.updateContent(
            (input3?: Dynamic): Dynamic =>
              input3.files[input2] !== undefined &&
              (0, runtime.isLoadingArtboardHtml)(input3.files[input2])
                ? {
                    files: {
                      ...input3.files,
                      [input2]: options2,
                    },
                  }
                : input3,
            {
              auto: true,
            },
          ),
        resync: (): Dynamic =>
          input.updateContent(
            (input2?: Dynamic): Dynamic => ({
              files: {
                ...input2.files,
              },
            }),
            {
              auto: true,
            },
          ),
      });
    }
    function value12(input?: Dynamic): Dynamic {
      input.census !== null &&
        (0, runtime.reportDesignOpened)(
          input.doc,
          input.census,
          (): Dynamic => ({
            published: (0, runtime.getAllFileReferencePaths)(),
            designSystems: (0, runtime.getDesignSystems)().length,
          }),
          runtime.frameAnalyticsReporter,
        );
    }
    function value13(input?: Dynamic): Dynamic {
      let value14: Dynamic = value10 ? value10() : input;
      value10 = undefined;
      let doc: Dynamic = value14.doc,
        value15: Dynamic =
          value14.entryFile ?? (0, runtime.primaryDesignFile)(doc.content());
      value15 === null && (value15 = "Main.dc.html");
      (0, runtime.setKvClient)(
        value14.kvCap !== undefined
          ? (0, runtime.createDocumentKvAdapter)(
              doc,
              value14.kvCap.maxFileBytes,
              value14.kvCap.why,
            )
          : (0, runtime.createDocumentKvAdapter)(doc),
      );
      value11(doc);
      value12(value14);
      (document as Dynamic).querySelector(
        'meta[name="' + ["appifact", "emulator", "build"].join("-") + '"]',
      ) !== null && ((window as Dynamic).__appifactDoc = doc);
      let value16: Dynamic = (document as Dynamic).getElementById("root");
      if (!value16) throw new Error("no #root");
      let value17: Dynamic = (0, runtime.isFrameCaptureDocument)()
          ? runtime.runtimeEmbeddedReact
          : (0, runtime.preparePreviewRuntime)(runtime.runtimeEmbeddedReact),
        flag2: Dynamic = false,
        value18: Dynamic = (0,
        runtime.reactDomClientPlatformReactRuntime.createRoot)(value16),
        callback3: Dynamic = (
          input2?: Dynamic,
          options2?: Dynamic,
          context?: Dynamic,
        ): Dynamic =>
          (0, runtime.isFrameCaptureDocument)() ? (
            <runtime.DesignCover
              key={context}
              assets={value17}
              doc={input2}
              maySnapshot={value3 === null && true}
            />
          ) : (
            <runtime.DesignDocumentRoot
              key={context}
              filePath={options2}
              assets={value17}
              doc={input2}
            />
          ),
        callback4: Dynamic = (): Dynamic => {
          flag2 ||
            ((flag2 = true),
            value18.render(callback3(doc, value15)),
            value3 !== null && (0, runtime.dispatchDesignReady)());
        };
      value9 = (input2?: Dynamic): Dynamic => {
        (0, runtime.setKvClient)(
          (0, runtime.createDocumentKvAdapter)(input2.doc),
        );
        value11(input2.doc);
        value12(input2);
        flag2 = true;
        value18.render(
          callback3(
            input2.doc,
            (0, runtime.primaryDesignFile)(input2.doc.content()) ?? value15,
            "no-store",
          ),
        );
        value3 !== null && (0, runtime.dispatchDesignReady)();
      };
      let value19: Dynamic = performance.now();
      value3 !== null &&
        ((0, runtime.installEmbeddedLifecycle)(doc), callback4());
      value2 = (): Dynamic => (window as Dynamic).setTimeout(callback4, 300);
      value !== undefined &&
        (window as Dynamic).setTimeout(
          callback4,
          Math.max(0, value + 300 - value19),
        );
      (window as Dynamic).setTimeout(
        callback4,
        Math.max(0, startedAt + 3e3 - value19),
      );
    }
    Promise.all([
      (0, runtime.initializeDatabaseRuntime)(),
      (0, runtime.probeBlobScriptSupport)(),
    ])
      .then((): Dynamic => value8())
      .then(value13)
      .catch((input?: Dynamic): Dynamic => {
        console.error("design: boot failed", input);
      });
  }
  bindRuntimeValue(
    runtime,
    "bootstrapJsxRuntime",
    () => bootstrapJsxRuntime,
    (value) => {
      bootstrapJsxRuntime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_BOOT_CONTENT",
    () => EMPTY_BOOT_CONTENT,
    (value) => {
      EMPTY_BOOT_CONTENT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fetchArtifactFile",
    () => fetchArtifactFile,
    (value) => {
      fetchArtifactFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "bootstrapArtifactApplication",
    () => bootstrapArtifactApplication,
  );
  return () => {
    bootstrapJsxRuntime = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    EMPTY_BOOT_CONTENT = {
      files: {},
    };
    fetchArtifactFile = (input?: Dynamic): Dynamic =>
      fetch(input, {
        credentials: "same-origin",
        signal: AbortSignal.timeout(
          input.startsWith(runtime.ProjectValue) ? 12e4 : 1e4,
        ),
      });
  };
}
