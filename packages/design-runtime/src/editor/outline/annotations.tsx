/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorOutlineAnnotations(
  runtime: RuntimeBindings,
): () => void {
  var OutlineAnnotationsSlice: Dynamic;
  var ViewOnlyYouCanInspectThisMessage: Dynamic;
  var OutlineAnnotationsLabel: Dynamic;
  var ADrawnLineOrPathCannotMessage: Dynamic;
  var reactOutlineAnnotations: Dynamic;
  var OutlineAnnotationsIsWorkerConfig: Dynamic;
  var OutlineAnnotationsIsWorkerOnOmEventRoundtripConfig: Dynamic;
  var OutlineAnnotationsResolvedValue: Dynamic;
  function annotationFirstTextLine(source?: Dynamic): Dynamic {
    if (source.kind === "title1")
      return (
        (0, runtime.NotesDomHandler_2)(source.text).trim().split(`
`)[0] ?? ""
      );
    let value: Dynamic = (0, runtime.parseNoteBlocks)(source.text.trim())[0],
      value2: Dynamic =
        value == null
          ? ""
          : value.kind === "p"
            ? value.text
            : (value.items[0] ?? "");
    return (0, runtime.parseNoteInlineMarkdown)(value2, {
      escapes: true,
      literalUnsafeLinks: true,
    })
      .map((input?: Dynamic): Dynamic => input.text)
      .join("");
  }
  function annotationOutlineDetail(source?: Dynamic): Dynamic {
    if (source.kind === "image") {
      let value2: Dynamic = (0, runtime.OutlineNativeMenuReplace)(
        source.alt ?? "",
      );
      return value2
        ? {
            detail: OutlineAnnotationsSlice(value2),
            ...(value2.length > runtime.OutlineNativeMenuLimit
              ? {
                  detailTitle: value2,
                }
              : {}),
          }
        : {};
    }
    if (!("text" in source)) return {};
    let value: Dynamic = annotationFirstTextLine(source).trim();
    return value
      ? {
          detail: `\u201C${(0, runtime.OutlineNativeMenuSlice)(value)}\u201D`,
        }
      : {};
  }
  function annotationOutlineNode(source?: Dynamic): Dynamic {
    let value: Dynamic =
      source.kind === undefined
        ? runtime.OutlineNativeMenuLabelGlyphConfig
        : source.kind === "image" && source.video !== undefined
          ? runtime.OutlineNativeMenuLabelGlyphConfig_2
          : runtime.OutlineNativeMenuTitle1RectOvalConfig[source.kind];
    return {
      id: source.id,
      label: value.label,
      glyph: value.glyph,
      ...annotationOutlineDetail(source),
    };
  }
  function reconcileAnnotationOutline(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(),
      value: Dynamic = input.map((source?: Dynamic): Dynamic => {
        values.add(source.id);
        let value2: Dynamic =
            source.kind === "image"
              ? (source.video !== undefined ? "video:" : "") +
                (source.alt ?? "")
              : "text" in source
                ? source.text
                : undefined,
          entry: Dynamic = options.get(source.id);
        if (entry && entry.kind === source.kind && entry.text === value2)
          return entry.row;
        let value3: Dynamic = annotationOutlineNode(source);
        options.set(source.id, {
          kind: source.kind,
          text: value2,
          row: value3,
        });
        return value3;
      });
    for (let value2 of options.keys() as Dynamic)
      values.has(value2) || options.delete(value2);
    return value;
  }
  bindRuntimeValue(
    runtime,
    "annotationFirstTextLine",
    () => annotationFirstTextLine,
  );
  bindRuntimeValue(
    runtime,
    "OutlineAnnotationsSlice",
    () => OutlineAnnotationsSlice,
    (value) => {
      OutlineAnnotationsSlice = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "annotationOutlineDetail",
    () => annotationOutlineDetail,
  );
  bindRuntimeValue(
    runtime,
    "annotationOutlineNode",
    () => annotationOutlineNode,
  );
  bindRuntimeValue(
    runtime,
    "reconcileAnnotationOutline",
    () => reconcileAnnotationOutline,
  );
  bindRuntimeValue(
    runtime,
    "ViewOnlyYouCanInspectThisMessage",
    () => ViewOnlyYouCanInspectThisMessage,
    (value) => {
      ViewOnlyYouCanInspectThisMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineAnnotationsLabel",
    () => OutlineAnnotationsLabel,
    (value) => {
      OutlineAnnotationsLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ADrawnLineOrPathCannotMessage",
    () => ADrawnLineOrPathCannotMessage,
    (value) => {
      ADrawnLineOrPathCannotMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactOutlineAnnotations",
    () => reactOutlineAnnotations,
    (value) => {
      reactOutlineAnnotations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineAnnotationsIsWorkerConfig",
    () => OutlineAnnotationsIsWorkerConfig,
    (value) => {
      OutlineAnnotationsIsWorkerConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineAnnotationsIsWorkerOnOmEventRoundtripConfig",
    () => OutlineAnnotationsIsWorkerOnOmEventRoundtripConfig,
    (value) => {
      OutlineAnnotationsIsWorkerOnOmEventRoundtripConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineAnnotationsResolvedValue",
    () => OutlineAnnotationsResolvedValue,
    (value) => {
      OutlineAnnotationsResolvedValue = value;
    },
  );
  return () => {
    OutlineAnnotationsSlice = (items?: Dynamic): Dynamic =>
      items.length > runtime.OutlineNativeMenuLimit
        ? `${items.slice(0, 13)}\u2026${items.slice(-12)}`
        : items;
    ViewOnlyYouCanInspectThisMessage =
      "View only \u2014 you can inspect this design but not change it";
    OutlineAnnotationsLabel = "Select an element first";
    ADrawnLineOrPathCannotMessage =
      "A drawn line or path cannot be reordered yet";
    reactOutlineAnnotations = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeNpm_usehooks_ts_p0)();
    OutlineAnnotationsIsWorkerConfig = {
      isWorker: false,
      emitOmEvent(input: Dynamic, options: Dynamic): Dynamic {
        (window as Dynamic).dispatchEvent(
          new CustomEvent(input, {
            detail: options,
          }),
        );
      },
      onOmEvent(input: Dynamic, options: Dynamic): Dynamic {
        let callback: Dynamic = (input2?: Dynamic): Dynamic =>
          options(input2.detail);
        (window as Dynamic).addEventListener(input, callback);
        return (): Dynamic =>
          (window as Dynamic).removeEventListener(input, callback);
      },
      roundtrip(input: Dynamic): Dynamic {
        return new Promise((input2?: Dynamic): Dynamic => {
          let callback: Dynamic = (): Dynamic => {
            value();
            input2({
              ok: false,
              error: "Aborted",
            });
          };
          function value(): Dynamic {
            clearTimeout(value2);
            (window as Dynamic).removeEventListener(
              input.responseEvent,
              value3,
            );
            input.signal?.removeEventListener("abort", callback);
          }
          let value2: Dynamic = setTimeout((): Dynamic => {
            value();
            input2({
              ok: false,
              error: input.timeoutError,
            });
          }, input.timeout);
          function value3(input3?: Dynamic): Dynamic {
            let detail: Dynamic = input3.detail;
            if (input.filter && !input.filter(detail)) return;
            value();
            let value4: Dynamic = input.reject?.(detail);
            input2(
              value4
                ? {
                    ok: false,
                    error: value4,
                  }
                : {
                    ok: true,
                    value: input.extract(detail),
                  },
            );
          }
          (window as Dynamic).addEventListener(input.responseEvent, value3);
          input.signal?.addEventListener("abort", callback, {
            once: true,
          });
          (window as Dynamic).dispatchEvent(
            new CustomEvent(input.dispatch.name, {
              detail: input.dispatch.detail,
            }),
          );
        });
      },
      execToolInTab(): Dynamic {
        return Promise.reject(new Error("execToolInTab called from tab host"));
      },
      mirrorPreviewFile(): Dynamic {},
      broadcastSubagents(): Dynamic {},
      readSetting(input: Dynamic): Dynamic {
        try {
          return localStorage.getItem(input) ?? sessionStorage.getItem(input);
        } catch {
          return null;
        }
      },
      trackTurnEvent(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
        value: Dynamic,
      ): Dynamic {
        (window as Dynamic).dispatchEvent(
          new CustomEvent("telemetry:track", {
            detail: {
              eventType: input,
              properties: options,
              chatId: context,
              projectId: value,
            },
          }),
        );
      },
      reportSpan(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
        value: Dynamic,
      ): Dynamic {
        (window as Dynamic).dispatchEvent(
          new CustomEvent("telemetry:span", {
            detail: {
              name: input,
              opts: options,
              chatId: context,
              projectId: value,
            },
          }),
        );
      },
      captureTranscript(): Dynamic {},
    };
    OutlineAnnotationsIsWorkerOnOmEventRoundtripConfig = {
      isWorker: false,
      emitOmEvent(): Dynamic {},
      onOmEvent: (): Dynamic => (): Dynamic => {},
      roundtrip: (): Dynamic =>
        Promise.resolve({
          ok: false,
          error: "no host",
        }),
      execToolInTab: (): Dynamic => Promise.reject(new Error("no host")),
      mirrorPreviewFile(): Dynamic {},
      broadcastSubagents(): Dynamic {},
      readSetting: (): Dynamic => null,
      trackTurnEvent(): Dynamic {},
      reportSpan(): Dynamic {},
      captureTranscript(): Dynamic {},
    };
    OutlineAnnotationsResolvedValue =
      typeof window !== "undefined"
        ? OutlineAnnotationsIsWorkerConfig
        : OutlineAnnotationsIsWorkerOnOmEventRoundtripConfig;
  };
}
