/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasNote(runtime: RuntimeBindings): () => void {
  var jsxCanvasNote: Dynamic;
  function CanvasNote({
    spec: spec,
    editing: editing,
    commenting = false,
    selected: selected,
    grouped = false,
    objectPress: objectPress,
    onChange: onChange,
    onGesture: onGesture,
    armWindowGestureEnd: armWindowGestureEnd,
    onTextEditing: onTextEditing,
    autoEdit: autoEdit,
    onMeasure: onMeasure,
    snapLines: snapLines,
    onSnapGuides: onSnapGuides,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)(
      autoEdit === true,
    );
    (0, runtime.reactCanvasPanZoom.useEffect)(
      (): Dynamic => (
        onTextEditing?.(value),
        (): Dynamic => {
          value && onTextEditing?.(false);
        }
      ),
      [value],
    );
    let value3: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(null),
      value4: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(null),
      value5: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(null),
      callback: Dynamic = (): Dynamic => {
        value5.current &&
          (document as Dynamic).removeEventListener(
            "focusout",
            value5.current,
            true,
          );
        value5.current = null;
      };
    (0, runtime.reactCanvasPanZoom.useEffect)((): Dynamic => callback, []);
    let value6: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(null),
      value7: Dynamic = spec.kind === "title1",
      value8: Dynamic = (0, runtime.useViewportStore)(),
      value9: Dynamic = spec.rotate ?? 0,
      value10: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(editing);
    value10.current = editing;
    let [value11, value12]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)(
        null,
      ),
      callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (!value6.current) return;
        let bounds: Dynamic = value6.current.getBoundingClientRect(),
          [items2, items3]: Dynamic = [
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
          ],
          [items4, items5]: Dynamic = [
            value9,
            (0, runtime.angleBetweenPoints)(
              items2,
              items3,
              options.clientX,
              options.clientY,
            ),
          ];
        (0, runtime.beginArtboardResize)(options, {
          src: "ann-resize",
          scale: value8.get().scale,
          sound: (): Dynamic => value10.current,
          onGesture: onGesture,
          armWindowGestureEnd: armWindowGestureEnd,
          patchAt: (
            input2?: Dynamic,
            options2?: Dynamic,
            context?: Dynamic,
          ): Dynamic => {
            let value47: Dynamic = (0, runtime.snapRotation)(
              items4 +
                (0, runtime.angleBetweenPoints)(
                  items2,
                  items3,
                  context.clientX,
                  context.clientY,
                ) -
                items5,
              context.shiftKey,
            );
            value12(value47);
            return {
              rotate: value47,
            };
          },
          onChange: onChange,
          restore: {
            rotate: items4,
          },
          onEnd: (): Dynamic => value12(null),
        });
      },
      value13: Dynamic = (0, runtime.reactCanvasPanZoom.useCallback)(
        (input?: Dynamic): Dynamic => (
          (value6.current = input),
          value7 ? value8.stamp(input) : undefined
        ),
        [value8, value7],
      ),
      value14: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(null),
      value15: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(null),
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        if (input.pointerType !== "touch") return;
        let [items2, items3]: Dynamic = [input.pointerId, value8.get()],
          callback7: Dynamic = (input2?: Dynamic): Dynamic => {
            if (input2.pointerId === items2) {
              for (let value47 of ["pointercancel", "pointerup"] as Dynamic)
                (window as Dynamic).removeEventListener(
                  value47,
                  callback7,
                  true,
                );
              input2.type === "pointercancel" &&
                (window as Dynamic).setTimeout(
                  (): Dynamic => value8.set(items3),
                  0,
                );
            }
          };
        for (let value47 of ["pointercancel", "pointerup"] as Dynamic)
          (window as Dynamic).addEventListener(value47, callback7, true);
      },
      [value16, value17]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)({
        above: false,
        below: false,
      }),
      value18: Dynamic = (0,
      runtime.reactCanvasPanZoom.useCallback)((): Dynamic => {
        let current: Dynamic = value14.current;
        if (!current) return;
        let value47: Dynamic = (0, runtime.CanvasPanZoomScrollTop)(current);
        value17(
          (input?: Dynamic): Dynamic =>
            input.above === value47.above && input.below === value47.below
              ? input
              : value47,
        );
      }, []),
      value19: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(null),
      [value20, value21]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)({
        w: 0,
        h: 0,
      }),
      [value22, value23]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)(
        null,
      ),
      [value24, value25]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)(0),
      [value26, value27]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)(
        null,
      ),
      [value28, value29]: Dynamic = (0, runtime.reactCanvasPanZoom.useState)({
        w: 0,
        h: 0,
      }),
      value30: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(onMeasure);
    value30.current = onMeasure;
    let value31: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(value);
    value31.current = value;
    (0, runtime.reactCanvasPanZoom.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value6.current;
      if (!current) return;
      let callback7: Dynamic = (): Dynamic => {
          let state2: Dynamic = {
            w: current.offsetWidth,
            h: current.offsetHeight,
          };
          value29(state2);
          value31.current || value30.current?.(state2);
        },
        observer: Dynamic = new ResizeObserver(callback7);
      observer.observe(current);
      callback7();
      let callback8: Dynamic = (): Dynamic => {
          value18();
          let [items2, items3]: Dynamic = [value19.current, value15.current];
          items2 &&
            value21(
              (input?: Dynamic): Dynamic =>
                input.w === items2.offsetWidth &&
                input.h === items2.offsetHeight
                  ? input
                  : {
                      w: items2.offsetWidth,
                      h: items2.offsetHeight,
                    },
            );
          items3 && value25(items3.offsetHeight);
        },
        observer2: Dynamic = new ResizeObserver(callback8);
      for (let value47 of [
        value14.current,
        value15.current,
        value19.current,
      ] as Dynamic)
        value47 && observer2.observe(value47);
      callback8();
      return (): Dynamic => {
        observer.disconnect();
        observer2.disconnect();
      };
    }, [value18, value7]);
    (0, runtime.reactCanvasPanZoom.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value6.current;
      !value &&
        current &&
        value30.current?.({
          w: current.offsetWidth,
          h: current.offsetHeight,
        });
    }, [value]);
    (0, runtime.reactCanvasPanZoom.useEffect)((): Dynamic => {
      (!editing || !selected) && value && callback4();
    }, [editing, selected]);
    (0, runtime.reactCanvasPanZoom.useEffect)((): Dynamic => {
      if (!value) return;
      let current: Dynamic = value3.current;
      if (!current) return;
      value7
        ? ((current.textContent = (0, runtime.NotesDomHandler_2)(spec.text)),
          (value32.current = current.textContent))
        : ((0, runtime.applyNoteMarkdownDom)(current, spec.text),
          (value32.current = (0, runtime.serializeNoteDom)(current)));
      value33.current = false;
      let value47: Dynamic = (0, runtime.installNoteInputRules)(
          current,
          (): Dynamic =>
            value7 ? null : (0, runtime.annotationTextStyle)(spec),
        ),
        value48: Dynamic = (value4.current = (0, runtime.createNoteLinkEditor)(
          current,
        ));
      current.focus();
      (0, runtime.moveNoteCaretToEnd)(current) &&
        value14.current &&
        (value14.current.scrollTop = value14.current.scrollHeight);
      return (): Dynamic => {
        value47();
        value48.stop();
      };
    }, [value]);
    let value32: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(""),
      value33: Dynamic = (0, runtime.reactCanvasPanZoom.useRef)(false),
      callback4: Dynamic = (input: Dynamic = "leave"): Dynamic => {
        let current: Dynamic = value3.current;
        if (!current) {
          value23(null);
          return value2(false);
        }
        let value47: Dynamic = null,
          value48: Dynamic = value7
            ? current.innerText.replace(/\n$/, "")
            : (0, runtime.serializeNoteDom)(current);
        if (value48 !== value32.current) {
          let value49: Dynamic = value7
            ? (0, runtime.NotesDomJoin)(
                (0, runtime.PlatformFileContentSlice_2)(value48),
              )
            : (0, runtime.NotesBlocksReplace_2)(value48);
          if (value49.length <= runtime.PlatformFileContentLimit_4)
            value47 = value7
              ? value49
              : (0, runtime.PlatformFileContentSlice_2)(value49);
          else if (input === "escape" && !value33.current) {
            value33.current = true;
            (0, runtime.showEditorToast)(
              "This note is over its " +
                String(runtime.PlatformFileContentLimit_4) +
                "-character limit. Shorten it to save; leaving discards the edit.",
            );
            return;
          } else
            (0, runtime.showEditorToast)(
              "Edit discarded. The note was over its " +
                String(runtime.PlatformFileContentLimit_4) +
                "-character limit.",
            );
        }
        value2(false);
        value23(null);
        value47 !== null &&
          value47 !== spec.text &&
          onChange(
            {
              text: value47,
            },
            true,
          );
      },
      value34: Dynamic = (0, runtime.annotationTextStyle)(spec),
      value35: Dynamic = (0, runtime.reactCanvasPanZoom.useMemo)(
        (): Dynamic =>
          value7
            ? (0, runtime.NotesDomHandler_2)(spec.text)
            : (0, runtime.renderNoteMarkdown)(spec.text),
        [spec.text, value7],
      ),
      value36: Dynamic = (0, runtime.PlatformFileContentMin)(value34.size),
      value37: Dynamic = (0, runtime.PlatformFileContentKind)(spec),
      value38: Dynamic = !value7 && value24 > value37,
      value39: Dynamic = !value7 && (value || (editing ? selected : value38));
    (0, runtime.reactCanvasPanZoom.useLayoutEffect)((): Dynamic => {
      !value39 && value14.current && (value14.current.scrollTop = 0);
      value18();
    }, [value39, value18]);
    let value40: Dynamic = value7
        ? (0, runtime.annotationTextFit)(
            value20,
            value34.size,
            (0, runtime.PlatformFileContentMaxW)(spec),
            value37,
          )
        : null,
      value41: Dynamic = value40 !== null && (value40.k < 1 || value40.wrap),
      value42: Dynamic =
        !value40 || !value41
          ? null
          : value40.wrap
            ? {
                w: (0, runtime.PlatformFileContentMaxW)(spec),
                h: Math.min(
                  Math.ceil(value24 * value40.k),
                  value ? 1 / 0 : value37,
                ),
              }
            : {
                w: Math.ceil(value20.w * value40.k),
                h: Math.ceil(value20.h * value40.k),
              },
      value43: Dynamic =
        value40?.wrap && !value && Number.isFinite(value37)
          ? Math.max(
              1,
              Math.floor(
                (value37 / value40.k - 2 * value36.py) /
                  (value34.size * value36.lh),
              ),
            )
          : null,
      value44: Dynamic =
        value7 && !value40?.wrap
          ? {
              ...(0, runtime.NotesLinkEditingSize)(spec),
              whiteSpace: "pre",
            }
          : (0, runtime.NotesLinkEditingSize)(spec),
      value45: Dynamic = (0, runtime.CanvasPanZoomRound)(value34.size),
      items: Dynamic = [
        value16.above ? "transparent" : "#000",
        "#000 " + String(value16.above ? value45 : 0) + "px",
        "#000 calc(100% - " + String(value16.below ? value45 : 0) + "px)",
        value16.below ? "transparent" : "#000",
      ],
      value46: Dynamic =
        value16.above || value16.below
          ? "linear-gradient(to bottom, " + items.join(", ") + ")"
          : undefined,
      callback5: Dynamic = (): Dynamic =>
        value15.current?.offsetHeight ?? value28.h,
      callback6: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        spec.maxH === undefined &&
        input >= callback5() &&
        input <= (0, runtime.PlatformFileContentMax_2)(options, value34.size)
          ? undefined
          : Math.min(runtime.PlatformFileContentConstant_13, Math.round(input)),
      state: Dynamic = {
        ...objectPress,
        onPointerDown: (input?: Dynamic): Dynamic =>
          editing && !value ? objectPress.onPointerDown?.(input) : undefined,
      };
    return (
      <div
        ref={value13}
        data-mega-chrome={"annotation"}
        data-mega-annotation={spec.id}
        data-testid={"mega-annotation-" + spec.id}
        data-note-kind={spec.kind ?? "note"}
        data-note-size={(0, runtime.annotationTextStyle)(spec).size}
        className={(0, runtime.joinClassNames)(
          "absolute rounded-[2px]",
          !editing && "pointer-events-none",
          editing && !value && "cursor-grab",
          value7
            ? (0, runtime.joinClassNames)(
                "shadow-[0_0_0_var(--ring-w,0px)_var(--cds-border-strong)]",
                value && "[--ring-w:var(--hair)]",
                editing && !selected && "hover:[--ring-w:var(--hair)]",
              )
            : (0, runtime.joinClassNames)(
                "shadow-md",
                !selected && "ring-1 ring-black/10",
              ),
        )}
        style={{
          left: spec.x,
          top: spec.y,
          width: value7 ? (value42?.w ?? "max-content") : spec.w,
          height: value42?.h,
          background: value7
            ? undefined
            : (0, runtime.NotesLinkEditingHandler)(value34.fill),
          isolation: "isolate",
          ...(value9
            ? {
                transform: "rotate(" + String(value9) + "deg)",
              }
            : {}),
          ...(value7
            ? {
                "--hair": "calc(1px * var(--mega-inv-scale))",
              }
            : {}),
          ...(commenting && !editing
            ? {
                pointerEvents: "auto",
              }
            : {}),
        }}
        {...state}
        onDoubleClick={(input?: Dynamic): Dynamic => {
          !editing || value || (input.stopPropagation(), value2(true));
        }}
      >
        <div
          ref={value7 ? undefined : value14}
          data-note-scroll={value7 ? undefined : ""}
          onScroll={value7 ? undefined : value18}
          tabIndex={!editing && value38 ? 0 : undefined}
          role={!editing && value38 ? "region" : undefined}
          aria-label={!editing && value38 ? "Sticky note, scrolls" : undefined}
          onPointerDown={!value7 && !editing ? callback3 : undefined}
          style={
            value7
              ? value42
                ? {
                    width: value42.w,
                    height: value42.h,
                    ...(value43 !== null
                      ? {
                          overflow: "hidden",
                          touchAction: "none",
                        }
                      : {}),
                  }
                : undefined
              : {
                  maxHeight: value37,
                  overflowX: "hidden",
                  overflowY: value39 ? "auto" : "hidden",
                  touchAction:
                    value38 && (value || !editing) ? "pan-y" : "none",
                  overscrollBehavior: "contain",
                  pointerEvents: !editing && value38 ? "auto" : undefined,
                  maskImage: value46,
                  WebkitMaskImage: value46,
                }
          }
        >
          <div
            ref={value15}
            style={
              value40 && value41
                ? {
                    width: value40.wrap
                      ? (0, runtime.PlatformFileContentMaxW)(spec) / value40.k
                      : value20.w,
                    transform: "scale(" + String(value40.k) + ")",
                    transformOrigin: "0 0",
                    paddingBottom: value43 !== null ? value36.py : undefined,
                  }
                : undefined
            }
          >
            {value ? (
              <div
                key={"edit"}
                ref={value3}
                contentEditable={true}
                {...runtime.NotesAutoformatOnPasteOnDropOnDragStartConfig}
                onFocus={callback}
                onBlur={(input?: Dynamic): Dynamic => {
                  if (
                    !(0, runtime.NotesLinkEditingClosest)(input.relatedTarget)
                  )
                    return callback4();
                  callback();
                  let callback7: Dynamic = (input2?: Dynamic): Dynamic => {
                    (0, runtime.NotesLinkEditingClosest)(
                      input2.relatedTarget,
                    ) ||
                      (callback(),
                      input2.relatedTarget !== value3.current && callback4());
                  };
                  value5.current = callback7;
                  (document as Dynamic).addEventListener(
                    "focusout",
                    callback7,
                    true,
                  );
                }}
                onInput={(event?: Dynamic): Dynamic => {
                  value33.current = false;
                  if (value7)
                    return value23(
                      event.currentTarget.innerText.replace(/\n$/, ""),
                    );
                  (0, runtime.handleNoteAutoformat)(
                    event.currentTarget,
                    event.nativeEvent,
                    runtime.serializeNoteDom,
                    ["ul", "ol"],
                    true,
                  );
                  (0, runtime.normalizeNoteLineBreaks)(event.currentTarget);
                }}
                onKeyDown={(event?: Dynamic): Dynamic => {
                  event.key === "Escape"
                    ? (event.preventDefault(),
                      event.stopPropagation(),
                      callback4("escape"))
                    : !value7 && event.key === "Enter" && event.shiftKey
                      ? (event.preventDefault(),
                        (document as Dynamic).execCommand("insertParagraph"))
                      : (0, runtime.handleNoteFormattingShortcut)(
                          event,
                          value7 ? null : value34,
                        );
                }}
                onPointerDown={(input?: Dynamic): Dynamic =>
                  input.stopPropagation()
                }
                onMouseDown={(input?: Dynamic): Dynamic =>
                  value4.current?.onMouseDown(input)
                }
                data-note-text={""}
                className={
                  "select-text whitespace-pre-wrap break-words outline-none"
                }
                style={value44}
              />
            ) : (
              <div
                key={"view"}
                data-note-text={""}
                className={"whitespace-pre-wrap break-words"}
                style={
                  value43 !== null
                    ? {
                        ...value44,
                        paddingBottom: 0,
                        minHeight: undefined,
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: value43,
                        overflow: "hidden",
                        touchAction: "none",
                      }
                    : value44
                }
              >
                {spec.text.length > 0 ? (
                  value35
                ) : (
                  <span
                    className={"opacity-40 whitespace-nowrap"}
                    style={{
                      fontSize: "min(1em, 24px)",
                    }}
                  >
                    {editing ? "Double-click to type" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {value7 && (
          <div
            ref={value19}
            aria-hidden={"true"}
            className={
              "pointer-events-none invisible absolute left-0 top-0 w-max whitespace-pre"
            }
            style={(0, runtime.NotesLinkEditingSize)(spec)}
          >
            {(value ? value22 : null) ?? value35}
          </div>
        )}
        {editing && selected && !value && (
          <div
            data-mega-chrome={"annotation-resize"}
            data-testid={"mega-annotation-resize-" + spec.id}
            data-grouped={grouped ? "" : undefined}
            className={"pointer-events-none absolute inset-0"}
            style={
              value9
                ? {
                    transform: "rotate(" + String(-value9) + "deg)",
                  }
                : undefined
            }
          >
            <runtime.ViewportScale>
              {(input?: Dynamic): Dynamic => (
                <runtime.SelectionRing
                  frame={{
                    x: 0,
                    y: 0,
                    w: value7 ? value28.w : spec.w,
                    h: value26 ?? value28.h,
                  }}
                  scale={input}
                  rotation={value9 ? (value9 * Math.PI) / 180 : undefined}
                  state={grouped ? "member" : "selected"}
                  grips={value7 || grouped ? "none" : "corners"}
                  onRotateStart={grouped ? undefined : callback2}
                  angleLabel={
                    value11 !== null ? String(value11) + "\xB0" : undefined
                  }
                  onGripDoubleClick={(): Dynamic => {
                    let value47: Dynamic = callback5();
                    onChange(
                      {
                        maxH:
                          value47 <=
                          (0, runtime.PlatformFileContentMax_2)(
                            spec.w,
                            value34.size,
                          )
                            ? undefined
                            : Math.min(
                                runtime.PlatformFileContentConstant_13,
                                Math.round(value47),
                              ),
                      },
                      true,
                    );
                  }}
                  onResizeStart={(
                    input2?: Dynamic,
                    options?: Dynamic,
                  ): Dynamic => {
                    let value47: Dynamic = !value9 && input2.y === "bottom",
                      state2: Dynamic = {
                        x: spec.x,
                        y: spec.y,
                        w: spec.w,
                        h: value47
                          ? Math.max(value28.h, spec.maxH ?? 0)
                          : value28.h,
                      },
                      value48: Dynamic =
                        !!value9 || input2.x === "left" || input2.y === "top",
                      value49: Dynamic = value9
                        ? null
                        : (snapLines?.() ?? null);
                    (0, runtime.beginArtboardResize)(options, {
                      src: "ann-resize",
                      scale: value8.get().scale,
                      sound: (): Dynamic => value10.current,
                      onGesture: onGesture,
                      armWindowGestureEnd: armWindowGestureEnd,
                      patchAt: (
                        input3?: Dynamic,
                        options2?: Dynamic,
                        context?: Dynamic,
                      ): Dynamic => {
                        let value50: Dynamic = value47
                            ? runtime.PlatformFileContentConstant_13
                            : Math.max(callback5(), value28.h),
                          value51: Dynamic =
                            input2.x !== null &&
                            input2.y !== null &&
                            !value9 &&
                            Math.abs(options2) * value8.get().scale < 6,
                          value52: Dynamic =
                            !value51 && !(value47 && input2.x !== null),
                          value53: Dynamic =
                            value49 && !(context.metaKey || context.ctrlKey)
                              ? (0, runtime.snapResize)(
                                  state2,
                                  {
                                    x: input2.x,
                                    y: value52 ? input2.y : null,
                                  },
                                  input3,
                                  value51 ? 0 : options2,
                                  value49.lines,
                                  value49.threshold,
                                )
                              : {
                                  dx: input3,
                                  dy: value51 ? 0 : options2,
                                  guides: [],
                                };
                        value47 &&
                          state2.h + value53.dy > callback5() &&
                          (value53 = {
                            dx: value53.dx,
                            dy: value51 ? 0 : options2,
                            guides: value53.guides.filter(
                              (input4?: Dynamic): Dynamic =>
                                input4.axis === "x",
                            ),
                          });
                        let value54: Dynamic = (0, runtime.resizeRotatedRect)(
                            state2,
                            value9,
                            input2,
                            value53.dx,
                            value53.dy,
                            {
                              w: runtime.PlatformFileContentConstant_9,
                              h: (0, runtime.NotesLinkEditingLh)(spec),
                            },
                            {
                              w: runtime.PlatformFileContentConstant_10,
                              h: value50,
                            },
                          ),
                          value55: Dynamic =
                            input2.x !== null
                              ? (0, runtime.NotesLinkEditingMin)(value54.w)
                              : spec.w,
                          value56: Dynamic =
                            input2.y === null
                              ? undefined
                              : Math.round(value54.h) === Math.round(state2.h)
                                ? spec.maxH
                                : callback6(value54.h, value55);
                        input2.y !== null &&
                          value27(
                            value56 !== undefined && value56 !== spec.maxH
                              ? value56
                              : null,
                          );
                        let value57: Dynamic = (0, runtime.activeResizeGuides)(
                          {
                            x: value48 ? Math.round(value54.x) : spec.x,
                            y: value48 ? Math.round(value54.y) : spec.y,
                            w: value55,
                            h: Math.round(value54.h),
                          },
                          input2,
                          value53.guides,
                        );
                        onSnapGuides?.(value57.length > 0 ? value57 : null);
                        return {
                          ...(value48
                            ? {
                                x: Math.round(value54.x),
                                y: Math.round(value54.y),
                              }
                            : {}),
                          ...(input2.x !== null
                            ? {
                                w: value55,
                              }
                            : {}),
                          ...(input2.y !== null
                            ? {
                                maxH: value56,
                              }
                            : {}),
                        };
                      },
                      onChange: onChange,
                      restore: {
                        ...(value48
                          ? {
                              x: spec.x,
                              y: spec.y,
                            }
                          : {}),
                        ...(input2.x !== null
                          ? {
                              w: spec.w,
                            }
                          : {}),
                        ...(input2.y !== null
                          ? {
                              maxH: spec.maxH,
                            }
                          : {}),
                      },
                      onEnd: (): Dynamic => {
                        value27(null);
                        onSnapGuides?.(null);
                      },
                    });
                  }}
                />
              )}
            </runtime.ViewportScale>
          </div>
        )}
      </div>
    );
  }
  bindRuntimeValue(runtime, "CanvasNote", () => CanvasNote);
  bindRuntimeValue(
    runtime,
    "jsxCanvasNote",
    () => jsxCanvasNote,
    (value) => {
      jsxCanvasNote = value;
    },
  );
  return () => {
    jsxCanvasNote = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
