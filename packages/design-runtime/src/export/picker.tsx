/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installExportPicker(runtime: RuntimeBindings): () => void {
  var exportSupportsMultipleArtboards: Dynamic;
  var exportSupportsScale: Dynamic;
  var canvasExportMaxDurationMs: Dynamic;
  var exportChosenCountLabel: Dynamic;
  var jsx_gd: Dynamic;
  var focusExportPickerToolbar: Dynamic;
  var exportPickerAriaLabels: Dynamic;
  var exportPickerChromeHeight: Dynamic;
  function interactiveExportDeadline(
    startedAt?: Dynamic,
    now: Dynamic = Date.now(),
  ): Dynamic {
    return Math.max(now + 55e3, startedAt + 265e3);
  }
  function exportArtboardTitle(artboard?: Dynamic): Dynamic {
    return artboard.title ?? artboard.file.replace(/\.dc\.html$/, "");
  }
  function initialExportPickedFiles(
    format?: Dynamic,
    artboards?: Dynamic,
    focusedFile?: Dynamic,
    selectedFiles?: Dynamic,
    pageId?: Dynamic,
  ): Dynamic {
    if (focusedFile !== null && format === "pdf")
      return new Set(artboards.map((input?: Dynamic): Dynamic => input.file));
    let value: Dynamic =
      focusedFile === null
        ? undefined
        : artboards.find(
            (input?: Dynamic): Dynamic => input.file === focusedFile,
          );
    if (value) return new Set([value.file]);
    let value2: Dynamic = artboards
      .filter((input?: Dynamic): Dynamic => selectedFiles.has(input.file))
      .map((input?: Dynamic): Dynamic => input.file);
    if (format === "pdf")
      return new Set(
        value2.length > 0
          ? value2
          : artboards.map((input?: Dynamic): Dynamic => input.file),
      );
    if (value2.length > 0)
      return new Set(format === "png" && value2.length > 1 ? [] : value2);
    let value3: Dynamic =
      (pageId === null
        ? undefined
        : artboards.find(
            (input?: Dynamic): Dynamic => input.file === pageId,
          )) ?? artboards[0];
    return new Set(value3 ? [value3.file] : []);
  }
  function toggleExportPickedFile(
    format?: Dynamic,
    picked?: Dynamic,
    file?: Dynamic,
  ): Dynamic {
    if (!exportSupportsMultipleArtboards(format)) return new Set([file]);
    let values: Dynamic = new Set(picked);
    values.delete(file) || values.add(file);
    return values;
  }
  function pickedExportArtboards(
    artboards?: Dynamic,
    pickedFiles?: Dynamic,
  ): Dynamic {
    return artboards.filter(
      (input?: Dynamic): Dynamic => pickedFiles.has(input.file),
    );
  }
  function artboardSupportsExportScale(
    artboard?: Dynamic,
    scale?: Dynamic,
  ): Dynamic {
    return (
      scale === 1 ||
      artboard === undefined ||
      (0, runtime.imageCaptureScaleOptions)(artboard.w, artboard.h).some(
        (input?: Dynamic): Dynamic => input.scale === scale && input.fits,
      )
    );
  }
  function initialExportScale(artboards?: Dynamic, file?: Dynamic): Dynamic {
    return artboards.some(
      (input?: Dynamic): Dynamic =>
        input.file === file || !artboardSupportsExportScale(input, 2),
    )
      ? 1
      : 2;
  }
  function artboardNeedsScaledDownExport(artboard?: Dynamic): Dynamic {
    return !(0, runtime.imageCaptureScaleOptions)(artboard.w, artboard.h).some(
      (input?: Dynamic): Dynamic => input.fits && input.scale <= 2,
    );
  }
  function describeExportScaleOption(
    artboards?: Dynamic,
    scale?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let [value]: Dynamic = artboards;
    if (value === undefined)
      return {
        offered: true,
        title: "Export at " + String(scale) + "\xD7",
      };
    if (artboards.length > 1) {
      let value3: Dynamic = artboards.find(
        (input?: Dynamic): Dynamic =>
          !artboardSupportsExportScale(input, scale),
      );
      if (value3)
        return {
          offered: false,
          title:
            "\u201C" +
            exportArtboardTitle(value3) +
            "\u201D is too large to export at " +
            String(scale) +
            "\xD7",
        };
      let value4: Dynamic = artboards.find(artboardNeedsScaledDownExport);
      return value4
        ? {
            offered: true,
            title:
              "\u201C" +
              exportArtboardTitle(value4) +
              "\u201D exports smaller than full size: it is over the capture limit",
          }
        : {
            offered: true,
            title:
              "Export " +
              String(artboards.length) +
              " artboards at " +
              String(scale) +
              "\xD7",
          };
    }
    let value2: Dynamic = (0, runtime.imageCaptureScaleOptions)(
      value.w,
      value.h,
    ).find((input?: Dynamic): Dynamic => input.scale === scale);
    return value2?.fits
      ? {
          offered: true,
          title:
            String(value2.outW) +
            ((0, runtime.getArtboardCaptureMode)(value, options) === "full"
              ? " px wide, full length"
              : " \xD7 " + String(value2.outH) + " px"),
        }
      : scale === 1
        ? {
            offered: true,
            title:
              "Exports smaller than full size: this artboard is over the capture limit",
          }
        : {
            offered: false,
            title:
              "This artboard is too large to export at " +
              String(scale) +
              "\xD7",
          };
  }
  function exportPickedArtboardsLabel(
    format?: Dynamic,
    picked?: Dynamic,
    total?: Dynamic,
  ): Dynamic {
    if (format === "png")
      return picked[0]
        ? "\u201C" + exportArtboardTitle(picked[0]) + "\u201D chosen"
        : "No artboard chosen";
    let length: Dynamic = picked.length;
    return length === 0
      ? "No artboards chosen"
      : length === total && total > 1
        ? "All " + String(total) + " artboards chosen"
        : exportChosenCountLabel(length, total) +
          (length < total ? " artboards chosen" : " artboard chosen");
  }
  function exportPickerInstructions(
    format?: Dynamic,
    pickedCount?: Dynamic,
    total?: Dynamic,
  ): Dynamic {
    return format === "png"
      ? {
          hint: "Choose an artboard to export",
          action: "Export PNG",
        }
      : format === "pngs"
        ? {
            hint: "Choose artboards to export",
            action:
              pickedCount > 1
                ? "Export " +
                  exportChosenCountLabel(pickedCount, total) +
                  " PNGs (.zip)"
                : pickedCount === 1 && total > 1
                  ? "Export 1 of " + String(total) + " as PNG"
                  : "Export PNG",
          }
        : {
            hint: "Choose artboards to include",
            action:
              pickedCount === 0
                ? "Export PDF"
                : "Export " +
                  exportChosenCountLabel(pickedCount, total) +
                  " as PDF",
          };
  }
  function validExportSessionScale(
    session?: Dynamic,
    artboards?: Dynamic,
  ): Dynamic {
    return pickedExportArtboards(artboards, session.picked).every(
      (input?: Dynamic): Dynamic =>
        artboardSupportsExportScale(input, session.scale),
    )
      ? session.scale
      : 1;
  }
  function useExportPicker(options?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, runtime.react_Su.useState)(null),
      value3: Dynamic = (0, runtime.react_Su.useRef)(null),
      value4: Dynamic = (0, runtime.react_Su.useRef)(null),
      value5: Dynamic = (0, runtime.react_Su.useRef)(options);
    value5.current = options;
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        value3.current = input;
        value2(input);
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let undoEnter: Dynamic = input.undoEnter;
        input.undoEnter = null;
        undoEnter?.();
        if (
          !value3.current ||
          (callback(null), !(document as Dynamic).hasFocus())
        )
          return;
        let activeElement: Dynamic = (document as Dynamic).activeElement;
        if (
          !(
            activeElement === null ||
            activeElement === (document as Dynamic).body ||
            activeElement.closest("[data-artboard-pick]") !== null
          )
        )
          return;
        let focusWas: Dynamic = input.focusWas,
          value20: Dynamic =
            focusWas instanceof HTMLElement &&
            focusWas.isConnected &&
            focusWas !== (document as Dynamic).body &&
            focusWas.tagName !== "IFRAME",
          callback3: Dynamic = (): Dynamic =>
            (value5.current.homeFocus?.() ?? null)?.focus({
              preventScroll: true,
            });
        if (!value20) return callback3();
        let callback4: Dynamic = (input2?: Dynamic): Dynamic => {
          focusWas.isConnected &&
            focusWas.focus({
              preventScroll: true,
            });
          if ((document as Dynamic).activeElement === focusWas) return;
          let activeElement2: Dynamic = (document as Dynamic).activeElement;
          (activeElement2 !== null &&
            activeElement2 !== (document as Dynamic).body &&
            activeElement2.closest("[data-artboard-pick]") === null) ||
            (input2 > 0
              ? requestAnimationFrame((): Dynamic => callback4(input2 - 1))
              : callback3());
        };
        callback4(2);
      },
      value6: Dynamic = (0, runtime.react_Su.useCallback)((): Dynamic => {
        let current: Dynamic = value4.current;
        value4.current = null;
        current
          ? (clearTimeout(current.timer),
            current.offSignal(),
            callback2(current))
          : value3.current && callback(null);
      }, []),
      value7: Dynamic = (0, runtime.react_Su.useCallback)(
        (input?: Dynamic): Dynamic => {
          try {
            value5.current.onStage?.(input);
          } catch {}
        },
        [],
      ),
      value8: Dynamic = (0, runtime.react_Su.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value4.current,
            current2: Dynamic = value3.current;
          return !current || !current2
            ? false
            : (current2.busy
                ? (current.run.abort(new runtime.ExportCancelled()),
                  callback2(current),
                  value7("dropped"))
                : (current.reject(new runtime.ExportCancelled()),
                  value6(),
                  value7(
                    input === "leave"
                      ? "left"
                      : input === "lapse"
                        ? "lapsed"
                        : "cancelled",
                  )),
              true);
        },
        [value6, value7],
      ),
      value9: Dynamic = (0, runtime.react_Su.useCallback)(
        (): Dynamic => value8("cancel"),
        [value8],
      ),
      value10: Dynamic = (0, runtime.react_Su.useCallback)(
        (): Dynamic => value8("leave"),
        [value8],
      ),
      value11: Dynamic = (0, runtime.react_Su.useCallback)(
        (): Dynamic => value4.current !== null || value3.current !== null,
        [],
      ),
      value12: Dynamic = (0, runtime.react_Su.useCallback)(
        (
          input?: Dynamic,
          options2?: Dynamic,
          context?: Dynamic,
          value20: Dynamic = canvasExportMaxDurationMs,
        ): Dynamic =>
          value4.current
            ? Promise.reject(
                new Error("An export is already choosing artboards."),
              )
            : context.aborted
              ? Promise.reject(new runtime.ExportCancelled())
              : new Promise((input2?: Dynamic, options3?: Dynamic): Dynamic => {
                  let value21: Dynamic = value5.current.enter(),
                    callback3: Dynamic = (): Dynamic => {
                      value8("signal");
                    };
                  context.addEventListener("abort", callback3);
                  let value22: Dynamic = setTimeout((): Dynamic => {
                      value3.current?.busy ||
                        (value5.current.onLapse(), value8("lapse"));
                    }, value20),
                    activeElement: Dynamic = (document as Dynamic)
                      .activeElement;
                  value4.current = {
                    resolve: input2,
                    reject: options3,
                    run: new AbortController(),
                    undoEnter: value21,
                    focusWas: activeElement,
                    timer: value22,
                    offSignal: (): Dynamic =>
                      context.removeEventListener("abort", callback3),
                  };
                  callback({
                    kind: input,
                    picked: options2.picked,
                    scale: options2.scale,
                    busy: false,
                  });
                  value7("opened");
                  let artboards: Dynamic = value5.current.artboards,
                    { hint: value23 }: Dynamic = exportPickerInstructions(
                      input,
                      options2.picked.size,
                      artboards.length,
                    ),
                    value24: Dynamic = pickedExportArtboards(
                      artboards,
                      options2.picked,
                    );
                  (0, runtime.announce)(
                    value24.length > 0
                      ? value23 +
                          ". " +
                          exportPickedArtboardsLabel(
                            input,
                            value24,
                            artboards.length,
                          )
                      : value23,
                  );
                }),
        [value8, value7],
      ),
      value13: Dynamic = (0, runtime.react_Su.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value3.current;
          current && !current.busy && callback(input(current));
        },
        [],
      ),
      value14: Dynamic = (0, runtime.react_Su.useCallback)(
        (input?: Dynamic): Dynamic =>
          value13((source?: Dynamic): Dynamic => {
            let value20: Dynamic = input(source);
            if (
              value20.size === source.picked.size &&
              [...value20].every(
                (input2?: Dynamic): Dynamic => source.picked.has(input2),
              )
            )
              return source;
            let artboards: Dynamic = value5.current.artboards;
            (0, runtime.announce)(
              exportPickedArtboardsLabel(
                source.kind,
                pickedExportArtboards(artboards, value20),
                artboards.length,
              ),
            );
            return {
              ...source,
              picked: value20,
            };
          }),
        [value13],
      ),
      value15: Dynamic = (0, runtime.react_Su.useCallback)(
        (input?: Dynamic, options2: Dynamic = false): Dynamic =>
          value14((source?: Dynamic): Dynamic => {
            let artboards: Dynamic = value5.current.artboards,
              value20: Dynamic = [...input].filter(
                (input2?: Dynamic): Dynamic =>
                  artboards.some(
                    (input3?: Dynamic): Dynamic => input3.file === input2,
                  ),
              );
            return value20.length === 0
              ? source.picked
              : !exportSupportsMultipleArtboards(source.kind) ||
                  (options2 && value20.length === 1)
                ? toggleExportPickedFile(source.kind, source.picked, value20[0])
                : new Set([...source.picked, ...value20]);
          }),
        [value14],
      ),
      value16: Dynamic = (0, runtime.react_Su.useCallback)(
        (input?: Dynamic): Dynamic =>
          value13(
            (input2?: Dynamic): Dynamic => ({
              ...input2,
              scale: input,
            }),
          ),
        [value13],
      ),
      value17: Dynamic = (0, runtime.react_Su.useCallback)(
        (): Dynamic =>
          value14(
            (source?: Dynamic): Dynamic =>
              exportSupportsMultipleArtboards(source.kind)
                ? new Set(
                    value5.current.artboards.map(
                      (input?: Dynamic): Dynamic => input.file,
                    ),
                  )
                : source.picked,
          ),
        [value14],
      ),
      value18: Dynamic = (0, runtime.react_Su.useCallback)((): Dynamic => {
        let current: Dynamic = value4.current,
          current2: Dynamic = value3.current;
        if (!current || !current2 || current2.busy) return;
        let artboards: Dynamic = value5.current.artboards,
          value20: Dynamic = pickedExportArtboards(
            artboards,
            current2.picked,
          ).map((input?: Dynamic): Dynamic => input.file);
        value20.length !== 0 &&
          (clearTimeout(current.timer),
          callback({
            ...current2,
            busy: true,
          }),
          value7("chosen"),
          current.resolve({
            files: value20,
            scale: validExportSessionScale(current2, artboards),
            signal: current.run.signal,
          }));
      }, [value7]),
      value19: Dynamic = value !== null;
    (0, runtime.react_Su.useEffect)((): Dynamic => {
      if (!value19) return;
      let callback3: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        let target: Dynamic = event.target;
        (target instanceof HTMLElement &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)) ||
          (event.preventDefault(), value9());
      };
      (window as Dynamic).addEventListener("keydown", callback3);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("keydown", callback3);
    }, [value19, value9]);
    (0, runtime.react_Su.useEffect)(
      (): Dynamic => (): Dynamic => {
        let current: Dynamic = value4.current;
        current &&
          ((value4.current = null),
          clearTimeout(current.timer),
          current.offSignal(),
          current.run.abort(new runtime.ExportCancelled()),
          current.reject(new runtime.ExportCancelled()));
      },
      [],
    );
    return {
      session: value,
      choose: value12,
      isUp: value11,
      end: value6,
      pick: value15,
      setScale: value16,
      selectAll: value17,
      confirm: value18,
      cancel: value9,
      leave: value10,
    };
  }
  function ExportPickerToolbar({
    picker: picker,
    artboards: artboards,
    rules: rules,
  }: Dynamic): Dynamic {
    let session: Dynamic = picker.session;
    if (!session) return null;
    let value: Dynamic = pickedExportArtboards(artboards, session.picked),
      value2: Dynamic = exportPickerInstructions(
        session.kind,
        value.length,
        artboards.length,
      ),
      value3: Dynamic = validExportSessionScale(session, artboards);
    return (
      <div
        ref={focusExportPickerToolbar}
        data-artboard-pick={""}
        className={
          "pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center"
        }
      >
        <runtime.SessionStrip
          tabIndex={-1}
          className={
            "pointer-events-auto outline-none [&_[data-mc-row]]:justify-center"
          }
          data-testid={"artboard-pick-bar"}
          aria-label={exportPickerAriaLabels[session.kind]}
          wrap={true}
          style={{
            overflow: "visible",
          }}
        >
          <span className={"px-2 text-xs text-fg-secondary"}>
            {value2.hint}
          </span>
          <runtime.SessionStripDivider />
          {exportSupportsScale(session.kind) && (
            <runtime.SessionStripGroup role={"group"} aria-label={"Scale"}>
              {[1, 2].map((input?: Dynamic): Dynamic => {
                let { offered: value4, title: value5 }: Dynamic =
                  describeExportScaleOption(value, input, rules);
                return (
                  <runtime.SessionStripButton
                    key={input}
                    data-testid={"artboard-pick-scale-" + String(input)}
                    aria-pressed={value3 === input}
                    disabled={session.busy || !value4}
                    title={value5}
                    onClick={(): Dynamic => picker.setScale(input)}
                  >
                    {String(input) + "\xD7"}
                  </runtime.SessionStripButton>
                );
              })}
            </runtime.SessionStripGroup>
          )}
          {exportSupportsScale(session.kind) &&
            exportSupportsMultipleArtboards(session.kind) && (
              <runtime.SessionStripDivider />
            )}
          {exportSupportsMultipleArtboards(session.kind) && (
            <runtime.SessionStripButton
              data-testid={"artboard-pick-all"}
              className={
                "aria-disabled:opacity-disabled aria-disabled:[&_[data-cds-part=paint]]:bg-transparent!"
              }
              aria-disabled={
                session.busy || value.length === artboards.length || undefined
              }
              onClick={picker.selectAll}
            >
              {"Select all"}
            </runtime.SessionStripButton>
          )}
          <runtime.SessionStripDivider />
          <runtime.SessionStripGroup>
            <runtime.SessionStripButton
              data-testid={"artboard-pick-cancel"}
              onClick={picker.cancel}
            >
              {"Cancel"}
            </runtime.SessionStripButton>
            <runtime.Button
              variant={"primary"}
              data-testid={"artboard-pick-export"}
              disabled={value.length === 0}
              busy={session.busy}
              busyLabel={"Exporting\u2026"}
              onMouseDown={(event?: Dynamic): Dynamic => event.preventDefault()}
              onClick={picker.confirm}
            >
              {value2.action}
            </runtime.Button>
          </runtime.SessionStripGroup>
        </runtime.SessionStrip>
      </div>
    );
  }
  function ExportArtboardPickTarget({
    artboard: artboard,
    picker: picker,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useViewportStore)(),
      session: Dynamic = picker.session;
    if (!session) return null;
    let value2: Dynamic = session.picked.has(artboard.file);
    return (
      <button
        type={"button"}
        data-mega-chrome={"export-pick"}
        data-artboard-pick={""}
        data-testid={"artboard-pick-" + artboard.file}
        aria-pressed={value2}
        aria-label={
          (exportSupportsMultipleArtboards(session.kind)
            ? 'Include "'
            : 'Choose "') +
          exportArtboardTitle(artboard) +
          '"'
        }
        aria-disabled={session.busy || undefined}
        className={
          "group pointer-events-auto absolute inset-0 block border-0 bg-transparent p-0 outline-none " +
          (session.busy ? "cursor-default" : "cursor-pointer")
        }
        style={runtime.PickerRuntimeScriptTAppAccentConfig}
        onMouseDown={(event?: Dynamic): Dynamic => event.preventDefault()}
        onClick={(): Dynamic => {
          session.busy || picker.pick([artboard.file], true);
        }}
      >
        {!value2 && (
          <span
            aria-hidden={"true"}
            className={"absolute inset-0 bg-white/55"}
          />
        )}
        {value2 && (
          <runtime.ViewportScale>
            {(input?: Dynamic): Dynamic => (
              <runtime.SelectionRing
                frame={{
                  x: 0,
                  y: 0,
                  w: artboard.w,
                  h: artboard.h,
                }}
                scale={input}
                grips={"none"}
              />
            )}
          </runtime.ViewportScale>
        )}
        <span
          ref={value.stamp}
          aria-hidden={"true"}
          className={"absolute left-0 top-0"}
          style={{
            transform: "scale(var(--mega-inv-scale))",
            transformOrigin: "left top",
          }}
        >
          <span
            data-testid={"artboard-pick-tick-" + artboard.file}
            className={
              "absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm group-focus-visible:outline-hidden group-focus-visible:shadow-focus " +
              (value2
                ? "border-app-accent bg-app-accent text-app-accent-fg"
                : "border-border-strong bg-white text-transparent")
            }
          >
            <runtime.Icon
              name={"Check"}
              size={"sm"}
              className={value2 ? undefined : "forced-colors:invisible"}
            />
          </span>
        </span>
      </button>
    );
  }
  bindRuntimeValue(
    runtime,
    "exportSupportsMultipleArtboards",
    () => exportSupportsMultipleArtboards,
    (value) => {
      exportSupportsMultipleArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportSupportsScale",
    () => exportSupportsScale,
    (value) => {
      exportSupportsScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasExportMaxDurationMs",
    () => canvasExportMaxDurationMs,
    (value) => {
      canvasExportMaxDurationMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "interactiveExportDeadline",
    () => interactiveExportDeadline,
  );
  bindRuntimeValue(runtime, "exportArtboardTitle", () => exportArtboardTitle);
  bindRuntimeValue(
    runtime,
    "initialExportPickedFiles",
    () => initialExportPickedFiles,
  );
  bindRuntimeValue(
    runtime,
    "toggleExportPickedFile",
    () => toggleExportPickedFile,
  );
  bindRuntimeValue(
    runtime,
    "pickedExportArtboards",
    () => pickedExportArtboards,
  );
  bindRuntimeValue(
    runtime,
    "artboardSupportsExportScale",
    () => artboardSupportsExportScale,
  );
  bindRuntimeValue(runtime, "initialExportScale", () => initialExportScale);
  bindRuntimeValue(
    runtime,
    "artboardNeedsScaledDownExport",
    () => artboardNeedsScaledDownExport,
  );
  bindRuntimeValue(
    runtime,
    "describeExportScaleOption",
    () => describeExportScaleOption,
  );
  bindRuntimeValue(
    runtime,
    "exportChosenCountLabel",
    () => exportChosenCountLabel,
    (value) => {
      exportChosenCountLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportPickedArtboardsLabel",
    () => exportPickedArtboardsLabel,
  );
  bindRuntimeValue(
    runtime,
    "exportPickerInstructions",
    () => exportPickerInstructions,
  );
  bindRuntimeValue(
    runtime,
    "jsx_gd",
    () => jsx_gd,
    (value) => {
      jsx_gd = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validExportSessionScale",
    () => validExportSessionScale,
  );
  bindRuntimeValue(runtime, "useExportPicker", () => useExportPicker);
  bindRuntimeValue(
    runtime,
    "focusExportPickerToolbar",
    () => focusExportPickerToolbar,
    (value) => {
      focusExportPickerToolbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportPickerAriaLabels",
    () => exportPickerAriaLabels,
    (value) => {
      exportPickerAriaLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportPickerChromeHeight",
    () => exportPickerChromeHeight,
    (value) => {
      exportPickerChromeHeight = value;
    },
  );
  bindRuntimeValue(runtime, "ExportPickerToolbar", () => ExportPickerToolbar);
  bindRuntimeValue(
    runtime,
    "ExportArtboardPickTarget",
    () => ExportArtboardPickTarget,
  );
  return () => {
    exportSupportsMultipleArtboards = (input?: Dynamic): Dynamic =>
      input !== "png";
    exportSupportsScale = (input?: Dynamic): Dynamic => input !== "pdf";
    canvasExportMaxDurationMs = 2e5;
    exportChosenCountLabel = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input > 0 && input < options
        ? String(input) + " of " + String(options)
        : String(input);
    jsx_gd = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    focusExportPickerToolbar = (input?: Dynamic): Dynamic =>
      input?.querySelector('[role="toolbar"]')?.focus({
        preventScroll: true,
      });
    exportPickerAriaLabels = {
      png: "Export an artboard as PNG",
      pngs: "Export artboards as PNG",
      pdf: "Export artboards as PDF",
    };
    exportPickerChromeHeight = 48;
  };
}
