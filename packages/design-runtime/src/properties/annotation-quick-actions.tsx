/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPropertiesAnnotationQuickActions(
  runtime: RuntimeBindings,
): () => void {
  var react_RB: Dynamic;
  var react_Nse: Dynamic;
  var jsx_Dse: Dynamic;
  var jsx_Eo: Dynamic;
  var noteFontSizePresets: Dynamic;
  function TextSelectionCount({
    base: base,
    words: words,
    chords = false,
    testid: testid,
  }: Dynamic): Dynamic {
    let [, value]: Dynamic = (0, react_Nse.useState)(0);
    (0, react_Nse.useEffect)((): Dynamic => {
      let callback2: Dynamic = (): Dynamic =>
        value((input?: Dynamic): Dynamic => input + 1);
      (document as Dynamic).addEventListener("selectionchange", callback2);
      (document as Dynamic).addEventListener("keyup", callback2);
      return (): Dynamic => {
        (document as Dynamic).removeEventListener("selectionchange", callback2);
        (document as Dynamic).removeEventListener("keyup", callback2);
      };
    }, []);
    let value2: Dynamic = (0, runtime.getNoteFormattingState)(document, base),
      callback: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value3?: Dynamic,
        extra?: Dynamic,
      ): Dynamic => {
        let value4: Dynamic = (0, runtime.noteFormattingRefusal)(
          input,
          base,
          document,
          words,
        );
        return (
          <runtime.SessionStripButton
            data-testid={
              testid === undefined ? undefined : testid + "-" + input
            }
            title={
              value4 ||
              (chords
                ? options +
                  " (" +
                  (0, runtime.keyboardShortcutLabel)(value3) +
                  ")"
                : options)
            }
            aria-label={options}
            aria-pressed={value4 === "" && extra}
            disabled={value4 !== ""}
            icon={context}
            onPointerDown={(event?: Dynamic): Dynamic => event.preventDefault()}
            onClick={(): Dynamic => {
              (0, runtime.toggleNoteFormatting)(input, base);
              value((input2?: Dynamic): Dynamic => input2 + 1);
            }}
          />
        );
      };
    return (
      <runtime.SessionStripGroup>
        {callback("bold", "Bold", "TextBold", "B", value2.allBold)}
        {callback("italic", "Italic", "TextItalics", "I", value2.allItalic)}
      </runtime.SessionStripGroup>
    );
  }
  function NoteTypographyQuickActions({
    spec: spec,
    onRestyle: onRestyle,
    typing = false,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.annotationTextStyle)(spec),
      value2: Dynamic = [
        "default",
        ...runtime.PlatformFileContentGrayRedOrangeValues,
      ].map(
        (input?: Dynamic): Dynamic => ({
          name: input,
          color: (0, runtime.NotesLinkEditingHandler_2)(value.kind, input),
          label:
            input === "default"
              ? "Default ink"
              : input[0].toUpperCase() + input.slice(1),
        }),
      ),
      value3: Dynamic = noteFontSizePresets.find(
        (input?: Dynamic): Dynamic => input.px === value.size,
      );
    return (
      <runtime.SessionStripGroup wrap={true}>
        <runtime.SessionTypographyPopup
          testid={"mega-note-style"}
          value={value3 ? String(value3.px) : null}
          chipText={value3?.label ?? String(value.size)}
          systemHeader={
            <div className={"mb-2"} data-testid={"mega-note-kind"}>
              <runtime.SegmentedControl
                aria-label={"Note style"}
                fullWidth={true}
                value={value.kind}
                onChange={(input?: Dynamic): Dynamic =>
                  onRestyle({
                    kind: input,
                  })
                }
                segments={["note", "title1"].map(
                  (input?: Dynamic): Dynamic => ({
                    value: input,
                    label: input === "note" ? "Sticky" : "Title",
                    disabled: typing && input !== value.kind,
                    disabledReason: "Finish typing to change the note's kind",
                  }),
                )}
              />
            </div>
          }
          options={noteFontSizePresets.map(
            (input?: Dynamic): Dynamic => ({
              value: String(input.px),
              text: input.label,
              label: (
                <span
                  style={{
                    fontSize: Math.min(22, Math.max(12, input.px / 2.5)),
                    fontWeight: value.kind === "title1" ? 700 : undefined,
                  }}
                >
                  {input.label}
                </span>
              ),
              hint: String(input.px) + "px",
            }),
          )}
          onChange={(input?: Dynamic): Dynamic =>
            onRestyle({
              size: Number(input),
            })
          }
          custom={{
            body: (
              <runtime.NumericInput
                aria-label={"Size"}
                unit={"px"}
                title={
                  typing ? "Finish typing to set a custom size" : "Size (px)"
                }
                disabled={typing}
                value={value.size}
                min={runtime.PlatformFileContentConstant_3}
                max={runtime.PlatformFileContentConstant_4}
                onValue={(input?: Dynamic): Dynamic => {
                  input !== undefined &&
                    onRestyle({
                      size: input,
                    });
                }}
              />
            ),
          }}
        />
        <runtime.SessionActionsPopover
          testid={"mega-note-color"}
          title={"Ink"}
          paint={(0, runtime.NotesLinkEditingHandler_2)(
            value.kind,
            value.color,
          )}
          swatches={value2}
          value={value.color}
          onSwatch={(input?: Dynamic): Dynamic =>
            onRestyle({
              color: input,
            })
          }
          editsAreUndoSteps={!typing}
        />
      </runtime.SessionStripGroup>
    );
  }
  function NoteFillQuickActions({
    spec: spec,
    onRestyle: onRestyle,
    typing = false,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.annotationTextStyle)(spec);
    if (value.kind !== "note") return null;
    let value2: Dynamic = [
      "default",
      ...runtime.PlatformFileContentGrayRedOrangeValuesAlias,
    ].map(
      (input?: Dynamic): Dynamic => ({
        name: input,
        color: (0, runtime.NotesLinkEditingHandler)(input),
        label:
          input === "default"
            ? "Default yellow"
            : input[0].toUpperCase() + input.slice(1),
      }),
    );
    return (
      <jsx_Eo.Fragment>
        <runtime.SessionStripDivider />
        <runtime.SessionStripGroup>
          <runtime.SessionActionsPopover
            testid={"mega-note-fill"}
            title={"Fill"}
            paint={(0, runtime.NotesLinkEditingHandler)(value.fill)}
            swatches={value2}
            value={value.fill}
            onSwatch={(input?: Dynamic): Dynamic =>
              onRestyle({
                fill: input,
              })
            }
            editsAreUndoSteps={!typing}
          />
        </runtime.SessionStripGroup>
      </jsx_Eo.Fragment>
    );
  }
  function NoteQuickActions({
    spec: spec,
    onRestyle: onRestyle,
    onDelete: onDelete,
    onComment: onComment,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.annotationTextStyle)(spec),
      value2: Dynamic =
        typeof window !== "undefined" &&
        (window as Dynamic).matchMedia("(pointer: coarse)").matches;
    return (
      <jsx_Eo.Fragment>
        <NoteTypographyQuickActions spec={spec} onRestyle={onRestyle} />
        <runtime.SessionStripGroup>
          <runtime.SessionStripButton
            data-testid={"mega-note-bold"}
            title={"Bold"}
            aria-label={"Bold"}
            aria-pressed={value.bold}
            icon={"TextBold"}
            onClick={(): Dynamic =>
              onRestyle({
                bold: !value.bold,
              })
            }
          />
          <runtime.SessionStripButton
            data-testid={"mega-note-italic"}
            title={"Italic"}
            aria-label={"Italic"}
            aria-pressed={value.italic}
            icon={"TextItalics"}
            onClick={(): Dynamic =>
              onRestyle({
                italic: !value.italic,
              })
            }
          />
        </runtime.SessionStripGroup>
        <NoteFillQuickActions spec={spec} onRestyle={onRestyle} />
        {onComment != null && (
          <jsx_Eo.Fragment>
            <runtime.SessionStripDivider />
            <runtime.SessionStripGroup>
              <runtime.SessionStripButton
                data-testid={"mega-note-comment"}
                icon={"ChatAdd"}
                title={"Comment on this note"}
                aria-label={"Comment"}
                onClick={(input?: Dynamic): Dynamic =>
                  onComment(input.currentTarget)
                }
              />
            </runtime.SessionStripGroup>
          </jsx_Eo.Fragment>
        )}
        {value2 && (
          <jsx_Eo.Fragment>
            <runtime.SessionStripDivider />
            <runtime.SessionStripGroup>
              <runtime.SessionStripButton
                data-testid={"mega-note-delete"}
                title={"Delete note \u2014 undo restores it"}
                aria-label={"Delete"}
                icon={"Trash"}
                onClick={onDelete}
              />
            </runtime.SessionStripGroup>
          </jsx_Eo.Fragment>
        )}
      </jsx_Eo.Fragment>
    );
  }
  function EditingNoteQuickActions({
    spec: spec,
    onRestyle: onRestyle,
    onComment: onComment,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.annotationTextStyle)(spec),
      [, value2]: Dynamic = (0, react_RB.useState)(0);
    (0, react_RB.useEffect)((): Dynamic => {
      let callback2: Dynamic = (): Dynamic =>
        value2((input?: Dynamic): Dynamic => input + 1);
      (document as Dynamic).addEventListener("selectionchange", callback2);
      (document as Dynamic).addEventListener("keyup", callback2);
      return (): Dynamic => {
        (document as Dynamic).removeEventListener("selectionchange", callback2);
        (document as Dynamic).removeEventListener("keyup", callback2);
      };
    }, []);
    let value3: Dynamic = (0, runtime.getNoteFormattingState)(document, value),
      callback: Dynamic =
        (input?: Dynamic): Dynamic =>
        (): Dynamic => {
          input();
          value2((input2?: Dynamic): Dynamic => input2 + 1);
        },
      value4: Dynamic = value3.ol ? "number" : value3.ul ? "bullet" : "none";
    return (
      <span
        data-note-typing-strip={""}
        style={{
          display: "contents",
        }}
        onKeyDown={(event?: Dynamic): Dynamic => {
          event.key === "Escape" &&
            (event.preventDefault(),
            (0, runtime.NotesFormattingGetSelection)());
        }}
      >
        <NoteTypographyQuickActions
          spec={spec}
          onRestyle={onRestyle}
          typing={true}
        />
        <TextSelectionCount base={value} testid={"mega-note-sel"} />
        <runtime.SessionStripDivider />
        <runtime.SessionStripGroup>
          <runtime.SessionChoicePopup
            testid={"mega-note-list"}
            title={
              "List: " +
              (value4 === "none"
                ? "None"
                : value4 === "bullet"
                  ? "Bulleted list"
                  : "Numbered list")
            }
            face={value4 === "number" ? "ListNumbered" : "ListBullet"}
            value={value4}
            options={[
              {
                value: "none",
                label: "None",
                icon: "Prohibit",
              },
              {
                value: "bullet",
                label: "Bulleted list",
                icon: "ListBullet",
              },
              {
                value: "number",
                label: "Numbered list",
                icon: "ListNumbered",
              },
            ]}
            onChange={(input?: Dynamic): Dynamic =>
              callback((): Dynamic => {
                input === "none"
                  ? value3.ul
                    ? (0, runtime.toggleNoteList)("ul")
                    : value3.ol && (0, runtime.toggleNoteList)("ol")
                  : (0, runtime.toggleNoteList)(
                      input === "bullet" ? "ul" : "ol",
                    );
              })()
            }
          />
        </runtime.SessionStripGroup>
        <NoteFillQuickActions spec={spec} onRestyle={onRestyle} typing={true} />
        {onComment != null && (
          <jsx_Eo.Fragment>
            <runtime.SessionStripDivider />
            <runtime.SessionStripGroup>
              <runtime.SessionStripButton
                data-testid={"mega-note-comment"}
                icon={"ChatAdd"}
                title={"Comment on this note"}
                aria-label={"Comment"}
                onPointerDown={(event?: Dynamic): Dynamic =>
                  event.preventDefault()
                }
                onClick={(input?: Dynamic): Dynamic =>
                  onComment(input.currentTarget)
                }
              />
            </runtime.SessionStripGroup>
          </jsx_Eo.Fragment>
        )}
      </span>
    );
  }
  function CanvasObjectQuickActions({
    spec: spec,
    onRecolor: onRecolor,
    onDelete: onDelete,
    onComment: onComment,
    cropping = false,
    onCrop: onCrop,
    cropReason: cropReason,
    clip: clip,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, react_RB.useRef)([]);
    if (
      spec.kind === "image" &&
      spec.video !== undefined &&
      clip !== undefined
    ) {
      let state: Dynamic = {
          get: (input?: Dynamic): Dynamic => spec.css?.[input],
          set: (input?: Dynamic, options?: Dynamic): Dynamic => {
            value.current = input.map(
              ([input2, input3]: Dynamic): Dynamic => ({
                prop: input2,
                value: input3 ?? null,
              }),
            );
            clip.onCss(value.current, options);
          },
          settle: (): Dynamic => clip.onCss(value.current, false),
        },
        callback: Dynamic = (): Dynamic => {
          let value8: Dynamic = (document as Dynamic).createElement("input");
          value8.type = "file";
          value8.accept =
            runtime.VideoMp4VideoWebmVideoQuicktimeMovValue + ",image/*";
          value8.hidden = true;
          (document as Dynamic).body.appendChild(value8);
          value8.addEventListener("cancel", (): Dynamic => value8.remove());
          value8.onchange = (): Dynamic => {
            let value9: Dynamic = value8.files?.[0];
            value8.remove();
            value9 && clip.onReplace(value9);
          };
          value8.click();
        };
      return (
        <jsx_Eo.Fragment>
          <runtime.SessionStripGroup>
            <runtime.VideoPlayControl
              find={(): Dynamic =>
                (document as Dynamic).querySelector(
                  (0, runtime.SessionArtboardStateEscape)(spec.id),
                )
              }
              whyAbsent={(): Dynamic =>
                (0, runtime.MediaPlaybackControlsQuerySelector)(spec.id)
              }
            />
          </runtime.SessionStripGroup>
          <runtime.ImageQuickPanel
            io={state}
            src={clip.src}
            ownAsset={true}
            onReplace={callback}
            replaceTitle={"Replace video"}
            onCrop={onCrop}
            cropping={cropping}
            cropReason={cropReason}
            noun={"video"}
          />
          <runtime.SessionStripDivider />
          <runtime.SessionStripGroup>
            {onComment != null && (
              <runtime.SessionStripButton
                data-testid={"mega-note-comment"}
                icon={"ChatAdd"}
                title={"Comment on this video"}
                aria-label={"Comment"}
                onClick={(input?: Dynamic): Dynamic =>
                  onComment(input.currentTarget)
                }
              />
            )}
            {clip.onOpenProps && (
              <runtime.SessionStripButton
                data-testid={"mega-note-props"}
                icon={"DotsVertical"}
                title={"Open the Properties panel"}
                aria-label={"Properties"}
                onClick={clip.onOpenProps}
              />
            )}
          </runtime.SessionStripGroup>
          {typeof window !== "undefined" &&
            (window as Dynamic).matchMedia("(pointer: coarse)").matches && (
              <jsx_Eo.Fragment>
                <runtime.SessionStripDivider />
                <runtime.SessionStripGroup>
                  <runtime.SessionStripButton
                    data-testid={"mega-note-delete"}
                    title={"Delete video \u2014 undo restores it"}
                    aria-label={"Delete"}
                    icon={"Trash"}
                    onClick={onDelete}
                  />
                </runtime.SessionStripGroup>
              </jsx_Eo.Fragment>
            )}
        </jsx_Eo.Fragment>
      );
    }
    let value2: Dynamic = spec.kind !== "rect" && spec.kind !== "oval",
      value3: Dynamic = spec.kind === "image",
      value4: Dynamic = spec.color ?? "default",
      value5: Dynamic = value2
        ? spec.css?.stroke
        : (spec.css?.background ?? spec.css?.["background-color"]),
      value6: Dynamic = [
        "default",
        ...runtime.PlatformFileContentGrayRedOrangeValues,
      ].map(
        (input?: Dynamic): Dynamic => ({
          name: input,
          color: (0, runtime.annotationColor)(spec.kind, input),
          label:
            input === "default"
              ? "Default gray"
              : input[0].toUpperCase() + input.slice(1),
        }),
      ),
      value7: Dynamic =
        typeof window !== "undefined" &&
        (window as Dynamic).matchMedia("(pointer: coarse)").matches;
    return (
      <jsx_Eo.Fragment>
        {!value3 && (
          <runtime.SessionStripGroup>
            <runtime.SessionActionsPopover
              testid={"mega-shape-color"}
              title={value2 ? "Stroke" : "Fill"}
              paint={value5 ?? (0, runtime.annotationColor)(spec.kind, value4)}
              swatches={value6}
              value={value5 !== undefined ? null : value4}
              onSwatch={(input?: Dynamic): Dynamic =>
                onRecolor(input === "default" ? "default" : input)
              }
              editsAreUndoSteps={true}
            />
          </runtime.SessionStripGroup>
        )}
        {value3 && onCrop && (
          <runtime.SessionStripGroup>
            <runtime.SessionStripButton
              data-testid={"mega-picture-crop"}
              data-media-crop-keep={""}
              icon={<runtime.PropertyOptionIcon icon={runtime.CropValue} />}
              title={
                cropReason ??
                (cropping
                  ? "Done cropping (or press Enter)"
                  : "Crop (or double-click the picture)")
              }
              aria-label={"Crop"}
              aria-pressed={cropping}
              onClick={onCrop}
              disabled={cropReason !== undefined}
            />
          </runtime.SessionStripGroup>
        )}
        {onComment != null && (
          <jsx_Eo.Fragment>
            {(!value3 || onCrop) && <runtime.SessionStripDivider />}
            <runtime.SessionStripGroup>
              <runtime.SessionStripButton
                data-testid={"mega-note-comment"}
                icon={"ChatAdd"}
                title={
                  value3
                    ? "Comment on this " +
                      (spec.kind === "image" && spec.video !== undefined
                        ? "video"
                        : "picture")
                    : "Comment on this shape"
                }
                aria-label={"Comment"}
                onClick={(input?: Dynamic): Dynamic =>
                  onComment(input.currentTarget)
                }
              />
            </runtime.SessionStripGroup>
          </jsx_Eo.Fragment>
        )}
        {value7 && (
          <jsx_Eo.Fragment>
            {(!value3 || onComment != null || onCrop) && (
              <runtime.SessionStripDivider />
            )}
            <runtime.SessionStripGroup>
              <runtime.SessionStripButton
                data-testid={"mega-note-delete"}
                title={
                  (value3
                    ? spec.kind === "image" && spec.video !== undefined
                      ? "Delete video"
                      : "Delete picture"
                    : "Delete shape") + " \u2014 undo restores it"
                }
                aria-label={"Delete"}
                icon={"Trash"}
                onClick={onDelete}
              />
            </runtime.SessionStripGroup>
          </jsx_Eo.Fragment>
        )}
      </jsx_Eo.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "react_RB",
    () => react_RB,
    (value) => {
      react_RB = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "react_Nse",
    () => react_Nse,
    (value) => {
      react_Nse = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_Dse",
    () => jsx_Dse,
    (value) => {
      jsx_Dse = value;
    },
  );
  bindRuntimeValue(runtime, "TextSelectionCount", () => TextSelectionCount);
  bindRuntimeValue(
    runtime,
    "jsx_Eo",
    () => jsx_Eo,
    (value) => {
      jsx_Eo = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noteFontSizePresets",
    () => noteFontSizePresets,
    (value) => {
      noteFontSizePresets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NoteTypographyQuickActions",
    () => NoteTypographyQuickActions,
  );
  bindRuntimeValue(runtime, "NoteFillQuickActions", () => NoteFillQuickActions);
  bindRuntimeValue(runtime, "NoteQuickActions", () => NoteQuickActions);
  bindRuntimeValue(
    runtime,
    "EditingNoteQuickActions",
    () => EditingNoteQuickActions,
  );
  bindRuntimeValue(
    runtime,
    "CanvasObjectQuickActions",
    () => CanvasObjectQuickActions,
  );
  return () => {
    react_RB = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeCdsIndex)();
    react_Nse = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    jsx_Dse = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    jsx_Eo = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    noteFontSizePresets = [
      {
        label: "Small",
        px: runtime.PlatformFileContentSMLConfig.s,
      },
      {
        label: "Medium",
        px: runtime.PlatformFileContentSMLConfig.m,
      },
      {
        label: "Large",
        px: runtime.PlatformFileContentSMLConfig.l,
      },
      {
        label: "Extra large",
        px: runtime.PlatformFileContentSMLConfig.xl,
      },
      {
        label: "Huge",
        px: runtime.PlatformFileContentSMLConfig.xxl,
      },
    ];
  };
}
