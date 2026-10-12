/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelUseDcModel(
  runtime: RuntimeBindings,
): () => void {
  function useDcModel(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let {
        enabled: value,
        sessionHeld: value2,
        nonDcFile: value3 = false,
      }: Dynamic = context,
      value4: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(context);
    value4.current = context;
    let value5: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(value3);
    value5.current = value3;
    let value6: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(value2);
    value6.current = value2;
    let value7: Dynamic = (0, runtime.artboardComponentName)(options),
      value8: Dynamic = options.includes("/")
        ? options.slice(0, options.lastIndexOf("/"))
        : "",
      value9: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic =>
          input2 === value7
            ? options
            : value8
              ? `${value8}/${input2}.dc.html`
              : `${input2}.dc.html`,
        [value8, options, value7],
      ),
      value10: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value11: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(false),
      value12: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value13: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic => {
          let entry: Dynamic = value10.current.get(input2);
          entry &&
            value12.current.set(
              input2,
              (entry.undoFloor ?? 0) + entry.undo.length + entry.redo.length,
            );
          value10.current.delete(input2);
        },
        [],
      ),
      value14: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value15: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Set()),
      value16: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Set()),
      value17: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(
        (): Dynamic => Promise.resolve(),
      ),
      value18: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(value);
    value18.current = value;
    let value19: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic =>
          runtime.projectFilesystem.readFileWithVersion
            ? runtime.projectFilesystem.readFileWithVersion(input2)
            : runtime.projectFilesystem.readFile(input2).then(
                (input3?: Dynamic): Dynamic => ({
                  content: input3,
                  version: undefined,
                }),
              ),
        [],
      ),
      value20: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic => value10.current.get(input2) ?? null,
        [],
      ),
      value21: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        async (input2?: Dynamic): Promise<Dynamic> => {
          let entry: Dynamic = value10.current.get(input2);
          if (entry) return entry;
          if (value5.current) {
            if (input2 !== value7) return null;
            let value60: Dynamic = await value4.current.fetchLiveBody?.(value7);
            if (value60 == null) return null;
            let value61: Dynamic = new runtime.DcEditorModel(value60, {
                raw: true,
              }),
              state2: Dynamic = {
                path: options,
                src: "",
                model: value61,
                originalTemplate: value61.serialize(),
                undo: [],
                redo: [],
                undoFloor: value12.current.get(input2) ?? 0,
                dirty: false,
              },
              entry3: Dynamic = value10.current.get(input2);
            return entry3 || (value10.current.set(input2, state2), state2);
          }
          let value53: Dynamic = value9(input2),
            current: Dynamic = value10.current,
            value54: Dynamic =
              input2 === value7 ? value4.current.historyKeeper : undefined,
            callback: Dynamic = (): Dynamic =>
              value11.current && value10.current === current;
          value54?.holds(value53) &&
            !(await value54.whenSettled(value53)) &&
            callback() &&
            value54.drop(value53, "unsaved");
          let value55: Dynamic, value56: Dynamic;
          try {
            if (runtime.projectFilesystem.readFileWithVersion) {
              let value60: Dynamic =
                await runtime.projectFilesystem.readFileWithVersion(
                  `${input}/${value53}`,
                );
              value55 = value60.content;
              value56 = value60.version;
            } else
              value55 = await runtime.projectFilesystem.readFile(
                `${input}/${value53}`,
              );
          } catch (value60: Dynamic) {
            console.error("[dc-model] failed to read", value53, value60);
            value54 && callback() && value54.drop(value53, "load");
            return null;
          }
          let value57: Dynamic = (0, runtime.parseDcHtmlDocument)(value55);
          if (!value57) {
            (0, runtime.warnUnreadableDcDocument)(
              input + "/" + value53,
              value55,
              "its elements cannot be listed, selected or edited",
            );
            value54 && callback() && value54.drop(value53, "load");
            return null;
          }
          let value58: Dynamic = new runtime.DcEditorModel(value57.template, {
              raw: false,
            }),
            state: Dynamic = {
              path: value53,
              src: value55,
              model: value58,
              originalTemplate: value58.serialize(),
              undo: [],
              redo: [],
              undoFloor: value12.current.get(input2) ?? 0,
              dirty: false,
              ...(value56 !== undefined
                ? {
                    adoptedVersion: value56,
                    baseVersion: value56,
                  }
                : {}),
            },
            entry2: Dynamic = value10.current.get(input2);
          if (entry2) return entry2;
          let value59: Dynamic =
            value54 && callback()
              ? value54.take(value53, value55, value4.current.historyEpoch)
              : null;
          value59 &&
            ((state.undo = value59.undo),
            (state.redo = value59.redo),
            (state.undoFloor = value59.undoFloor));
          value10.current.set(input2, state);
          return state;
        },
        [options, value9, input, value7],
      ),
      value22: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic => {
          let entry: Dynamic = value10.current.get(input2);
          if (!(!entry || value4.current.holdPush?.(input2))) {
            if (value5.current) {
              (0, runtime.emitEditorEvent)("nondc-push-body", {
                name: input2,
                content: entry.model.serialize(),
              });
              value4.current.onPushLive?.(input2);
              return;
            }
            (0, runtime.emitEditorEvent)("dc-update", {
              name: input2,
              path: entry.path,
              kind: "html",
              content: entry.model.serialize(),
              streaming: false,
              viewportKey: runtime.DcModelKey,
            });
            value4.current.onPushLive?.(input2);
          }
        },
        [],
      ),
      value23: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic => {
          if (value5.current) return;
          let entry: Dynamic = value10.current.get(input2);
          if (!entry?.dirty) {
            value25.current.delete(input2);
            return;
          }
          try {
            let value53: Dynamic = (0, runtime.parseDcHtmlDocument)(entry.src);
            if (!value53) return;
            let value54: Dynamic = (0, runtime.replaceDcTemplate)(
              entry.src,
              value53,
              (0, runtime.serializeStableModel)(entry),
            );
            if (entry.pendingScript !== undefined) {
              let value55: Dynamic = (0, runtime.parseDcHtmlDocument)(value54);
              value55 &&
                (value54 = (0, runtime.setDcScript)(
                  value54,
                  value55,
                  entry.pendingScript,
                ));
            }
            let entry2: Dynamic = value25.current.get(input2),
              flag: Dynamic = true;
            if (entry.pendingProps !== undefined) {
              let value55: Dynamic = (0, runtime.getPendingPropKeys)(
                value54,
                entry.pendingProps,
              );
              value55 === null ? (flag = false) : (value54 = value55);
            }
            let current: Dynamic = value14.current;
            current.set(entry.path, (current.get(entry.path) ?? 0) + 1);
            (0, runtime.expectLocalFileEcho)(entry.path);
            value26.current.set(input2, value54);
            runtime.projectFilesystem
              .writeFile(input + "/" + entry.path, value54)
              .then((): Dynamic => {
                value27.current.set(
                  input2,
                  (value27.current.get(input2) ?? 0) + 1,
                );
                flag &&
                  value25.current.get(input2) === entry2 &&
                  value25.current.delete(input2);
              })
              .catch((): Dynamic => {})
              .finally((): Dynamic => {
                setTimeout((): Dynamic => {
                  let value55: Dynamic = current.get(entry.path) ?? 0;
                  value55 <= 1
                    ? current.delete(entry.path)
                    : current.set(entry.path, value55 - 1);
                  (0, runtime.consumeLocalFileEcho)(entry.path);
                }, 500);
              });
          } catch {}
        },
        [input],
      ),
      value24: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value25: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value26: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value27: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value28: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value29: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map());
    (0, runtime.reactOutlineAnnotations.useEffect)((): Dynamic => {
      let current: Dynamic = value24.current,
        current2: Dynamic = value29.current;
      return (): Dynamic => {
        for (let value53 of current.values() as Dynamic) clearTimeout(value53);
        current.clear();
        for (let value53 of current2.values() as Dynamic) value53();
        current2.clear();
      };
    }, []);
    let value30: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(
        new Map(),
      ),
      value31: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => {
          let entry: Dynamic = value10.current.get(input2);
          if (!entry) return;
          entry.dirty = true;
          entry.previewBaseline = undefined;
          (0, runtime.ModelHistoryRebaseHandler_3)();
          value25.current.set(input2, (value25.current.get(input2) ?? 0) + 1);
          value4.current.onLocalEdit?.(input2);
          let current: Dynamic = value24.current,
            current2: Dynamic = value29.current,
            entry2: Dynamic = current.get(input2);
          entry2 && clearTimeout(entry2);
          current2.get(input2)?.();
          let value53: Dynamic;
          (0, runtime.trackEmbeddedWrite)(
            new Promise((input3?: Dynamic): Dynamic => (value53 = input3)),
          );
          current2.set(input2, value53);
          let value54: Dynamic = Date.now(),
            value55: Dynamic =
              options2?.now === true &&
              value54 - (value30.current.get(input2) ?? 0) > 800;
          value55 && value30.current.set(input2, value54);
          current.set(
            input2,
            setTimeout(
              (): Dynamic => {
                current.delete(input2);
                current2.delete(input2);
                value23(input2);
                value53();
              },
              value55 ? 0 : 800,
            ),
          );
        },
        [value23],
      ),
      value32: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value33: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(new Map()),
      value34: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        async (input2?: Dynamic): Promise<Dynamic> => {
          let current: Dynamic = value10.current,
            entry: Dynamic = current.get(input2);
          if (entry) {
            entry.custodyGen = (entry.custodyGen ?? 0) + 1;
            if (value5.current) {
              current.delete(input2);
              return;
            }
            try {
              let value53: Dynamic = runtime.projectFilesystem
                  .readFileWithVersion
                  ? (input3?: Dynamic): Dynamic =>
                      runtime.projectFilesystem.readFileWithVersion(input3)
                  : async (input3?: Dynamic): Promise<Dynamic> => ({
                      content: await runtime.projectFilesystem.readFile(input3),
                      version: undefined,
                    }),
                { content: value54, version: value55 }: Dynamic = await value53(
                  `${input}/${entry.path}`,
                );
              if (
                value55 !== undefined &&
                entry.adoptedVersion !== undefined &&
                value55 < entry.adoptedVersion
              )
                return;
              let value56: Dynamic = (0, runtime.parseDcHtmlDocument)(value54);
              if (!value56) {
                (0, runtime.warnUnreadableDcDocument)(
                  input + "/" + entry.path,
                  value54,
                  "the editor keeps showing the version it last read",
                );
                return;
              }
              entry.dirty = false;
              entry.carriedEditCount = 0;
              entry.src = value54;
              value26.current.delete(input2);
              let value57: Dynamic = (0, runtime.ModelHistoryRebaseDelete)(
                entry.path,
              );
              (0, runtime.ModelHistoryRebaseHandler_2)() && !value57
                ? (0, runtime.ModelHistoryRebaseUndo)(
                    input2,
                    (0, runtime.rebaseModelHistory)(
                      entry,
                      entry.model.serialize(),
                      value56.template,
                    ),
                  )
                : (0, runtime.resetUndoHistory)(entry);
              entry.pendingScript !== undefined &&
                ((entry.pendingScript = undefined),
                (entry.pendingScriptBase = undefined),
                (0, runtime.emitEditorEvent)("dc-update", {
                  name: input2,
                  path: entry.path,
                  kind: "js",
                  content: value56.js,
                  streaming: false,
                  viewportKey: runtime.DcModelKey,
                }));
              if (entry.pendingProps !== undefined) {
                let value59: Dynamic = Object.keys(entry.pendingProps);
                entry.pendingProps = undefined;
                entry.pendingPropsBase = undefined;
                value4.current.onPendingPropsDropped?.(input2, value59);
              }
              let value58: Dynamic = entry.previewBaseline !== undefined;
              entry.previewBaseline = undefined;
              if (value56.template !== entry.model.serialize()) {
                let value59: Dynamic = value58 ? null : entry.model;
                entry.model = entry.model.rebuild(value56.template);
                entry.liveStampsStale = false;
                entry.stampGen = (entry.stampGen ?? -1) + 1;
                value4.current.onExternalReparse?.(input2, value59);
              }
              entry.originalTemplate = entry.model.serialize();
              value55 !== undefined &&
                ((0, runtime.adoptModelVersion)(entry, value55),
                (entry.baseVersion === undefined ||
                  value55 > entry.baseVersion) &&
                  (entry.baseVersion = value55),
                value4.current.onAdopted?.(entry.path, value55, value54));
              value22(input2);
            } catch {
            } finally {
              entry.custodyGen = (entry.custodyGen ?? 0) + 1;
            }
          }
        },
        [input, value22],
      ),
      value35: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic => {
          if (value5.current) {
            let entry3: Dynamic = value10.current.get(input2);
            entry3 && (entry3.dirty = false);
            return Promise.resolve("noop");
          }
          let current: Dynamic = value10.current,
            entry: Dynamic = current.get(input2);
          if (entry && (0, runtime.getPreDragBaseline)(entry) === undefined)
            for (let value61 of runtime.ModelModelStateDataDcDraggingDataDcDragParentDataDcDragFollowerValues as Dynamic)
              entry.model.takeMarkerAttr(value61);
          let value53: Dynamic = entry
              ? (0, runtime.serializeStableModel)(entry)
              : undefined,
            value54: Dynamic = entry?.pendingScript,
            value55: Dynamic = entry?.pendingScriptBase,
            value56: Dynamic = entry?.pendingProps,
            value57: Dynamic = entry?.pendingPropsBase,
            value58: Dynamic = entry
              ? value4.current.getBaseline?.(entry.path)
              : undefined,
            value59: Dynamic = entry?.custodyGen ?? 0,
            entry2: Dynamic = value33.current.get(input2);
          if (
            entry2 &&
            entry2.models === current &&
            entry2.payload === value53 &&
            entry2.pendingScript === value54 &&
            entry2.pendingProps === value56
          )
            return entry2.run;
          let state: Dynamic = {},
            callback: Dynamic = async (): Promise<Dynamic> => {
              let entry3: Dynamic = value33.current.get(input2);
              entry3 &&
                entry3.token === state &&
                value33.current.delete(input2);
              let callback2: Dynamic = (): Dynamic =>
                value33.current.has(input2);
              if (
                !entry ||
                value53 === undefined ||
                (entry.custodyGen ?? 0) !== value59
              )
                return "noop";
              try {
                await value4.current.writes?.awaitWriteClearance();
              } catch {}
              let state2: Dynamic = {},
                entry4: Dynamic = value26.current.get(input2);
              if (
                entry4 !== undefined &&
                runtime.projectFilesystem.readFileWithVersion
              )
                try {
                  let content: Dynamic = (
                    await runtime.projectFilesystem.readFileWithVersion(
                      `${input}/${entry.path}`,
                    )
                  ).content;
                  state2 = {
                    mirrored: entry4,
                    diskIsMirror: content === entry4,
                  };
                } catch {
                  state2 = {
                    mirrored: entry4,
                  };
                }
              if ((entry.custodyGen ?? 0) !== value59) return "noop";
              let current2: Dynamic = value14.current;
              current2.set(entry.path, (current2.get(entry.path) ?? 0) + 1);
              (0, runtime.expectLocalFileEcho)(entry.path);
              let flag: Dynamic = true,
                callback3: Dynamic = (): Dynamic => {
                  flag &&
                    ((flag = false),
                    (0, runtime.consumeLocalFileEcho)(entry.path));
                },
                flag2: Dynamic = false,
                text: Dynamic = "failed",
                callback4: Dynamic = (input3?: Dynamic): Dynamic =>
                  input3?.code === 10;
              value39.current += 1;
              try {
                let state3: Dynamic = {
                    write: runtime.projectFilesystem.writeFileVersioned
                      ? (
                          input3?: Dynamic,
                          options2?: Dynamic,
                          context2?: Dynamic,
                        ): Dynamic =>
                          runtime.projectFilesystem.writeFileVersioned(
                            input3,
                            options2,
                            {
                              baseline: context2?.baseline,
                              conflictPolicy: value4.current.writes
                                ?.onWriteConflict
                                ? "fail"
                                : "merge",
                            },
                          )
                      : (input3?: Dynamic, options2?: Dynamic): Dynamic =>
                          runtime.projectFilesystem.writeFile(input3, options2),
                    read: (input3?: Dynamic): Dynamic =>
                      runtime.projectFilesystem.readFile(input3),
                    readWithVersion: runtime.projectFilesystem
                      .readFileWithVersion
                      ? (input3?: Dynamic): Dynamic =>
                          runtime.projectFilesystem.readFileWithVersion(input3)
                      : undefined,
                  },
                  callback5: Dynamic = (): Dynamic => ({
                    hasQueuedSuccessor: callback2(),
                    baselineAtCall: value58,
                    pendingScriptAtCall: value54,
                    pendingScriptBaseAtCall: value55,
                    pendingPropsAtCall: value56,
                    pendingPropsBaseAtCall: value57,
                    ...state2,
                  }),
                  value61: Dynamic = await (0, runtime.publishModelChanges)(
                    entry,
                    input,
                    state3,
                    value53,
                    callback5(),
                  );
                switch (
                  (value61.kind === "failed" &&
                    !callback4(value61.error) &&
                    (value61 = await (0, runtime.publishModelChanges)(
                      entry,
                      input,
                      state3,
                      value53,
                      callback5(),
                    )),
                  value61.version !== undefined &&
                    (0, runtime.adoptModelVersion)(entry, value61.version),
                  value61.kind)
                ) {
                  case "noop":
                    text = "noop";
                    callback3();
                    break;
                  case "failed": {
                    text = "failed";
                    callback3();
                    let value62: Dynamic = callback4(value61.error);
                    if (
                      value62 &&
                      value4.current.writes?.onWriteConflict &&
                      !callback2()
                    ) {
                      flag2 = true;
                      if (
                        (value54 !== undefined || value56 !== undefined) &&
                        (0, runtime.rebuildModelTemplate)(
                          entry.model,
                          value53,
                        ) ===
                          (0, runtime.rebuildModelTemplate)(
                            entry.model,
                            entry.originalTemplate,
                          )
                      ) {
                        console.warn(
                          "[dc-model] version conflict on a script/prop-only edit \u2014 reverting:",
                          entry.path,
                        );
                        try {
                          value4.current.writes?.onWriteReverted(
                            input2,
                            value61.error,
                          );
                        } catch (value63: Dynamic) {
                          console.error(
                            "[dc-model] revert callback threw:",
                            value63,
                          );
                        }
                      } else {
                        console.warn(
                          "[dc-model] version conflict \u2014 routing the edit to Claude:",
                          entry.path,
                        );
                        try {
                          value4.current.writes.onWriteConflict(
                            input2,
                            entry.path,
                            entry.originalTemplate,
                            value53,
                          );
                        } catch (value63: Dynamic) {
                          console.error(
                            "[dc-model] onWriteConflict threw:",
                            value63,
                          );
                        }
                      }
                      await value34(input2);
                      break;
                    }
                    if (!value62 && !callback2()) {
                      console.error(
                        "[dc-model] write failed twice \u2014 reverting to disk:",
                        value61.error,
                      );
                      flag2 = true;
                      try {
                        value4.current.writes?.onWriteReverted(
                          input2,
                          value61.error,
                        );
                      } catch (value63: Dynamic) {
                        console.error(
                          "[dc-model] revert callback threw:",
                          value63,
                        );
                      }
                      await value34(input2);
                      break;
                    }
                    console.error("[dc-model] write failed:", value61.error);
                    flag2 = true;
                    value4.current.writes?.onWriteError(value61.error);
                    break;
                  }
                  case "saved-adopted":
                    if (
                      ((entry.adoptedMerge = true),
                      (text = "saved"),
                      value10.current === current &&
                        !callback2() &&
                        entry.model.serialize() === value53)
                    )
                      try {
                        value4.current.writes?.onSavedAdopted(
                          input2,
                          value61.saved,
                        );
                      } catch (value62: Dynamic) {
                        console.error(
                          "[dc-model] onSavedAdopted threw after landed write:",
                          value62,
                        );
                      }
                    break;
                  case "saved":
                    text = "saved";
                    break;
                }
                (value61.kind === "saved" ||
                  value61.kind === "saved-adopted") &&
                  entry4 !== undefined &&
                  value26.current.get(input2) === entry4 &&
                  value26.current.delete(input2);
                if (
                  (value61.kind === "noop" ||
                    value61.kind === "saved" ||
                    value61.kind === "saved-adopted") &&
                  value61.settledProps !== undefined &&
                  value4.current.onPendingPropsSettled !== undefined &&
                  value10.current === current
                ) {
                  let value62: Dynamic = current.get(input2)?.pendingProps,
                    state4: Dynamic = {};
                  for (let [value63, value64] of Object.entries(
                    value61.settledProps,
                  ) as Dynamic) {
                    let value65: Dynamic =
                      value62 !== undefined && Object.hasOwn(value62, value63)
                        ? value62[value63]
                        : undefined;
                    (value65 === undefined || value65 === value64) &&
                      (state4[value63] = value64);
                  }
                  if (Object.keys(state4).length > 0)
                    try {
                      value4.current.onPendingPropsSettled(input2, state4);
                    } catch (value63: Dynamic) {
                      console.error(
                        "[dc-model] onPendingPropsSettled threw after settle:",
                        value63,
                      );
                    }
                }
                text === "saved" &&
                  (0, runtime.markLocalFileChange)(input, entry.path);
              } catch (value61: Dynamic) {
                text === "failed"
                  ? ((entry.dirty = true),
                    value25.current.set(
                      input2,
                      (value25.current.get(input2) ?? 0) + 1,
                    ),
                    callback3(),
                    flag2 || value4.current.writes?.onWriteError(value61))
                  : console.error(
                      "[dc-model] post-save callback threw after landed write:",
                      value61,
                    );
              } finally {
                value39.current -= 1;
                setTimeout((): Dynamic => {
                  let value61: Dynamic = current2.get(entry.path) ?? 0;
                  value61 <= 1
                    ? (current2.delete(entry.path),
                      value15.current.delete(entry.path) &&
                        value17.current(entry.path))
                    : current2.set(entry.path, value61 - 1);
                }, 500);
              }
              return text;
            },
            value60: Dynamic = (0, runtime.serializeAsyncFileTask)(
              value32.current,
              input2,
              callback,
            );
          entry &&
            value53 !== undefined &&
            value33.current.set(input2, {
              token: state,
              models: current,
              payload: value53,
              pendingScript: value54,
              pendingProps: value56,
              run: value60,
            });
          return value60;
        },
        [input, value34],
      ),
      value36: Dynamic = (0,
      runtime.reactOutlineAnnotations
        .useCallback)(async (): Promise<Dynamic> => {
        let items: Dynamic = [];
        for (let [value53, value54] of value10.current as Dynamic)
          value54.dirty && items.push(value35(value53));
        await Promise.allSettled(items);
      }, [value35]),
      value37: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(value36);
    value37.current = value36;
    let value38: Dynamic = (0,
      runtime.reactOutlineAnnotations.useCallback)((): Dynamic => {
        for (let value53 of value10.current.values() as Dynamic)
          if (value53.dirty) return true;
        return false;
      }, []),
      value39: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(0),
      value40: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (): Dynamic => value39.current > 0,
        [],
      ),
      value41: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic => value32.current.has(input2),
        [],
      ),
      value42: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => {
          let value53: Dynamic = value10.current.get(input2) ?? null;
          return !value53 || !(0, runtime.recordModelUndo)(value53, options2)
            ? false
            : (value4.current.onBeforeMutate?.(
                input2,
                value53,
                options2,
                false,
              ),
              true);
        },
        [],
      ),
      value43: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        async (
          input2?: Dynamic,
          options2?: Dynamic,
          context2?: Dynamic,
        ): Promise<Dynamic> => {
          let value53: Dynamic = context2?.structural ?? true,
            value54: Dynamic = value53 || (context2?.pushUndo ?? false),
            value55: Dynamic = context2?.restamp ?? true,
            value56: Dynamic = context2?.pushLive ?? true,
            current: Dynamic = value6.current,
            value57: Dynamic = await value21(input2);
          if (!value57) return false;
          let value58: Dynamic = value54 ? value57.model.serialize() : "";
          return options2(value57.model, value57)
            ? ((value57.previewBaseline = undefined),
              (value57.stampGen = (value57.stampGen ?? -1) + 1),
              value54 &&
                (value57.undo.push(value58),
                (0, runtime.trimUndoHistory)(
                  value57,
                  value57.undo.length - runtime.ModelModelStateConstant,
                ),
                (value57.redo = []),
                value4.current.onBeforeMutate?.(
                  input2,
                  value57,
                  value58,
                  value53,
                )),
              value55 && value57.model.restamp(),
              value56 && value22(input2),
              value55 && value56
                ? (value57.liveStampsStale = false)
                : value53 && (value57.liveStampsStale = true),
              (value57.dirty = true),
              current
                ? (value31(input2), "applied-dirty")
                : (await value35(input2)) === "failed"
                  ? "applied-failed"
                  : "applied")
            : "refused";
        },
        [value21, value22, value35, value31],
      ),
      value44: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        async (
          input2?: Dynamic,
          options2?: Dynamic,
          context2?: Dynamic,
        ): Promise<Dynamic> => {
          if ((0, runtime.isRecentlyEditedFile)(options2.path)) {
            await value34(input2);
            (0, runtime.ModelHistoryRebaseDelete)(options2.path);
            if (
              !(
                options2.dirty ||
                options2.pendingScript !== undefined ||
                options2.pendingProps !== undefined
              )
            )
              return;
            let entry: Dynamic = value24.current.get(input2);
            entry && clearTimeout(entry);
            value24.current.delete(input2);
            value29.current.get(input2)?.();
            value29.current.delete(input2);
            value25.current.delete(input2);
            options2.dirty = false;
            options2.pendingScript = undefined;
            options2.pendingScriptBase = undefined;
            options2.pendingProps = undefined;
            options2.pendingPropsBase = undefined;
            (0, runtime.resetUndoHistory)(options2);
            try {
              options2.src = (
                await value19(`${input}/${options2.path}`)
              ).content;
            } catch {
              value13(input2);
            }
            return;
          }
          if (
            value14.current.has(options2.path) &&
            !value28.current.get(input2)?.size
          ) {
            value15.current.add(options2.path);
            return;
          }
          let callback: Dynamic = (): Dynamic => {
            !context2?.noRetry &&
              !value16.current.has(options2.path) &&
              (value16.current.add(options2.path),
              setTimeout((): Dynamic => {
                value16.current.delete(options2.path);
                value17.current(options2.path, {
                  noRetry: true,
                });
              }, 2e3));
          };
          try {
            let value53: Dynamic = value27.current.get(input2) ?? 0,
              { content: value54, version: value55 }: Dynamic = await value19(
                `${input}/${options2.path}`,
              );
            if (
              (value14.current.has(options2.path) &&
                !value28.current.get(input2)?.has(value54)) ||
              value32.current.has(input2)
            ) {
              value15.current.add(options2.path);
              return;
            }
            if (
              value55 !== undefined &&
              options2.adoptedVersion !== undefined &&
              value55 <= options2.adoptedVersion
            ) {
              value28.current.get(input2)?.delete(value54);
              return;
            }
            if (
              options2.dirty ||
              options2.pendingScript !== undefined ||
              options2.pendingProps !== undefined
            ) {
              let value59: Dynamic =
                value28.current.get(input2)?.has(value54) === true;
              value59 &&
                (value27.current.get(input2) ?? 0) === value53 &&
                (value28.current.get(input2)?.delete(value54),
                value26.current.set(input2, value54));
              if (
                value4.current.liveStore &&
                !value25.current.has(input2) &&
                !value59 &&
                value54 !== value26.current.get(input2)
              ) {
                await value34(input2);
                options2.src === value54 ||
                  (value55 !== undefined &&
                    options2.adoptedVersion !== undefined &&
                    options2.adoptedVersion >= value55) ||
                  !(
                    options2.dirty ||
                    options2.pendingScript !== undefined ||
                    options2.pendingProps !== undefined
                  ) ||
                  (value54 !== options2.src && (options2.src = value54),
                  callback());
                return;
              }
              value54 !== options2.src && (options2.src = value54);
              value59 && (0, runtime.clearSavedPendingProps)(options2);
              value55 !== undefined &&
                (0, runtime.adoptModelVersion)(options2, value55);
              return;
            }
            if (value54 === options2.src) {
              value28.current.get(input2)?.delete(value54);
              value55 !== undefined &&
                ((0, runtime.adoptModelVersion)(options2, value55),
                (options2.baseVersion === undefined ||
                  value55 > options2.baseVersion) &&
                  (options2.baseVersion = value55));
              return;
            }
            let value56: Dynamic = (0, runtime.parseDcHtmlDocument)(value54);
            if (!value56) {
              (0, runtime.warnUnreadableDcDocument)(
                input + "/" + options2.path,
                value54,
                "the editor keeps showing the version it last read",
              );
              return;
            }
            value28.current.get(input2)?.delete(value54);
            let value57: Dynamic = !(0, runtime.sameDcTemplate)(
              value54,
              options2.src,
            );
            options2.src = value54;
            if (value57) {
              let value59: Dynamic = (0, runtime.ModelHistoryRebaseDelete)(
                options2.path,
              );
              (0, runtime.ModelHistoryRebaseHandler_2)() && !value59
                ? (0, runtime.ModelHistoryRebaseUndo)(
                    input2,
                    (0, runtime.rebaseModelHistory)(
                      options2,
                      options2.model.serialize(),
                      value56.template,
                    ),
                  )
                : (0, runtime.resetUndoHistory)(options2);
            }
            let value58: Dynamic = options2.previewBaseline !== undefined;
            options2.previewBaseline = undefined;
            if (value56.template !== options2.model.serialize()) {
              let value59: Dynamic = value58 ? null : options2.model;
              options2.model = options2.model.rebuild(value56.template);
              options2.stampGen = (options2.stampGen ?? -1) + 1;
              options2.liveStampsStale = true;
              options2.originalTemplate = options2.model.serialize();
              value4.current.onExternalReparse?.(input2, value59);
            }
            value55 !== undefined &&
              ((0, runtime.adoptModelVersion)(options2, value55),
              (options2.baseVersion === undefined ||
                value55 > options2.baseVersion) &&
                (options2.baseVersion = value55),
              value4.current.onAdopted?.(options2.path, value55, value54));
          } catch {
            callback();
          }
        },
        [input, value19, value34],
      ),
      value45: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        async (input2?: Dynamic, options2?: Dynamic): Promise<Dynamic> => {
          let value53: Dynamic = (0, runtime.normalizeProjectFilePath)(input2);
          for (let [value54, value55] of value10.current as Dynamic)
            value55.path === value53 &&
              (await value44(value54, value55, options2));
        },
        [value44],
      );
    value17.current = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
      !value18.current || value5.current
        ? Promise.resolve()
        : value45(input2, options2);
    let value46: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => {
          let value53: Dynamic = value28.current.get(input2) ?? new Set();
          value53.add(options2);
          value53.size > 4 && value53.delete(value53.values().next().value);
          value28.current.set(input2, value53);
          return (): Dynamic => {
            value53.delete(options2);
          };
        },
        [],
      ),
      value47: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        async (input2?: Dynamic): Promise<Dynamic> => {
          !value || value5.current || (await value45(input2));
        },
        [value45, value],
      ),
      value48: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        async (input2?: Dynamic): Promise<Dynamic> => {
          if (value5.current)
            return {
              outcome: "non-dc",
            };
          let entry: Dynamic = value10.current.get(input2),
            value53: Dynamic = await value21(input2);
          if (!value53)
            return {
              outcome: "read-failed",
            };
          if (!entry)
            return {
              outcome: "cold",
            };
          let value54: Dynamic =
            entry.dirty ||
            entry.pendingScript !== undefined ||
            entry.pendingProps !== undefined;
          if (value14.current.has(value53.path) || value32.current.has(input2))
            return {
              outcome: "self-write",
            };
          try {
            let { content: value55, version: value56 }: Dynamic = await value19(
              `${input}/${value53.path}`,
            );
            if (
              value14.current.has(value53.path) ||
              value32.current.has(input2)
            )
              return {
                outcome: "self-write",
              };
            if (value10.current.get(input2) !== value53)
              return {
                outcome: "read-failed",
              };
            let value57: Dynamic =
              value53.dirty ||
              value53.pendingScript !== undefined ||
              value53.pendingProps !== undefined;
            if (value55 === value53.src) {
              value56 !== undefined &&
                ((0, runtime.adoptModelVersion)(value53, value56),
                !value57 &&
                  (value53.baseVersion === undefined ||
                    value56 > value53.baseVersion) &&
                  (value53.baseVersion = value56));
              if (!value57)
                return {
                  outcome: "fresh",
                };
              if (value55 === value26.current.get(input2))
                return {
                  outcome: "fresh",
                };
              let value59: Dynamic = (0, runtime.parseDcHtmlDocument)(value55);
              return value59
                ? (0, runtime.rebuildModelTemplate)(
                    value53.model,
                    value59.template,
                  ) !==
                    (0, runtime.rebuildModelTemplate)(
                      value53.model,
                      value53.originalTemplate,
                    ) ||
                  (value53.pendingScript !== undefined &&
                    value59.js !== value53.pendingScriptBase) ||
                  (value53.pendingProps !== undefined &&
                    (0, runtime.getDcPropsJson)(value55) !==
                      value53.pendingPropsBase)
                  ? {
                      outcome: value54 ? "conflict" : "race-conflict",
                    }
                  : {
                      outcome: "fresh",
                    }
                : {
                    outcome: "unparseable",
                  };
            }
            if (
              value56 !== undefined &&
              value53.adoptedVersion !== undefined &&
              value56 <= value53.adoptedVersion
            )
              return {
                outcome: "fresh",
              };
            let value58: Dynamic = (0, runtime.parseDcHtmlDocument)(value55);
            if (!value58)
              return {
                outcome: "unparseable",
              };
            if (!value57) {
              await value34(input2);
              let value59: Dynamic =
                value53.src === value55 ||
                (value56 !== undefined &&
                  value53.adoptedVersion !== undefined &&
                  value53.adoptedVersion >= value56);
              value59 && (0, runtime.resetUndoHistory)(value53);
              return {
                outcome: value59 ? "rebuilt" : "read-failed",
              };
            }
            return value55 === value26.current.get(input2)
              ? (value56 !== undefined &&
                  (0, runtime.adoptModelVersion)(value53, value56),
                {
                  outcome: "fresh",
                })
              : (0, runtime.rebuildModelTemplate)(
                    value53.model,
                    value58.template,
                  ) ===
                    (0, runtime.rebuildModelTemplate)(
                      value53.model,
                      value53.originalTemplate,
                    ) &&
                  (value53.pendingScript === undefined ||
                    value58.js === value53.pendingScriptBase) &&
                  (value53.pendingProps === undefined ||
                    (0, runtime.getDcPropsJson)(value55) ===
                      value53.pendingPropsBase)
                ? ((value53.src = value55),
                  value56 !== undefined &&
                    (0, runtime.adoptModelVersion)(value53, value56),
                  {
                    outcome: "src-advanced",
                  })
                : (value55 !== value53.src && (value53.src = value55),
                  value56 !== undefined &&
                    (0, runtime.adoptModelVersion)(value53, value56),
                  {
                    outcome: value54 ? "conflict" : "race-conflict",
                  });
          } catch {
            return {
              outcome: "read-failed",
            };
          }
        },
        [value21, input, value19, value34],
      );
    (0, runtime.reactOutlineAnnotations.useEffect)(
      (): Dynamic => (
        (value11.current = true),
        (): Dynamic => {
          value11.current = false;
          let value53: Dynamic = (0, runtime.artboardComponentName)(options),
            value54: Dynamic = value5.current
              ? undefined
              : value10.current.get(value53);
          value37.current();
          let historyKeeper: Dynamic = value4.current.historyKeeper;
          historyKeeper &&
            !(
              value54 &&
              historyKeeper.keep(
                options,
                value54,
                value32.current.get(value53) ?? Promise.resolve(),
                value4.current.historyEpoch,
              )
            ) &&
            historyKeeper.decline(options);
          for (let [value55, value56] of value10.current as Dynamic)
            value12.current.set(
              value55,
              (value56.undoFloor ?? 0) +
                value56.undo.length +
                value56.redo.length,
            );
          value10.current = new Map();
          value25.current.clear();
          value26.current.clear();
          value27.current.clear();
          value28.current.clear();
        }
      ),
      [input, options],
    );
    let value49: Dynamic = (0, runtime.reactOutlineAnnotations.useRef)(0),
      value50: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (): Dynamic => value49.current > 0,
        [],
      );
    (0, runtime.npm_useEventListener_bc)(
      "files-changed",
      (input2?: Dynamic): Dynamic => {
        if (!value || value3 || input2.detail.projectPath !== input) return;
        let paths: Dynamic = input2.detail.paths,
          value53: Dynamic = paths.map(runtime.normalizeProjectFilePath);
        value49.current++;
        (async (): Promise<Dynamic> => {
          try {
            for (let [value54, value55] of value10.current as Dynamic)
              (!value53.includes(value55.path) && !paths.includes("*")) ||
                (await value44(value54, value55));
          } finally {
            value49.current--;
          }
        })();
      },
    );
    let value51: Dynamic = (0, runtime.reactOutlineAnnotations.useCallback)(
        (input2?: Dynamic): Dynamic => {
          for (let [value53, value54] of value10.current as Dynamic)
            input2(value53, value54);
        },
        [],
      ),
      value52: Dynamic = value13;
    return (0, runtime.reactOutlineAnnotations.useMemo)(
      (): Dynamic => ({
        rootName: value ? value7 : "",
        sessionHeld: value2,
        nonDcFile: value3,
        ensureModel: value21,
        state: value20,
        each: value51,
        dropModel: value52,
        pushLive: value22,
        markDirty: value31,
        writeNow: value35,
        refreshFromDisk: value34,
        adoptExternal: value47,
        adopting: value50,
        noteOwnWrite: value46,
        entryCheck: value48,
        flushAll: value36,
        anyDirty: value38,
        anyWriteInFlight: value40,
        commitInFlight: value41,
        mutate: value43,
        pushUndoSnapshot: value42,
      }),
      [
        value,
        value7,
        value2,
        value3,
        value21,
        value20,
        value51,
        value52,
        value22,
        value31,
        value35,
        value34,
        value47,
        value50,
        value46,
        value48,
        value36,
        value38,
        value40,
        value41,
        value43,
        value42,
      ],
    );
  }
  bindRuntimeValue(runtime, "useDcModel", () => useDcModel);
  return () => {};
}
