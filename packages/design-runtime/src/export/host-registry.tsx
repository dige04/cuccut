/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportHostRegistry(
  runtime: RuntimeBindings,
): () => void {
  var react_Su: Dynamic;
  var react_DB: Dynamic;
  var noninteractiveExportWindowMs: Dynamic;
  var interactiveExportWindowMs: Dynamic;
  var ExportCancelled: Dynamic;
  var registeredExportFormats: Dynamic;
  var registeredExportOptions: Dynamic;
  var queuedExportRequests: Dynamic;
  var activeExportRequests: Dynamic;
  function exportRequestsCompatible(
    first?: Dynamic,
    second?: Dynamic,
  ): Dynamic {
    return (
      first.interactive === second.interactive &&
      first.bundle === second.bundle &&
      first.sender === second.sender &&
      first.variant === second.variant &&
      first.windowMs <= second.windowMs
    );
  }
  function exportCapabilitiesByFormat(formats?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of formats as Dynamic) {
      let value2: Dynamic = items.findIndex(
          (input?: Dynamic): Dynamic => input.format === value.format,
        ),
        state: Dynamic = {
          format: value.format,
          ...(value.interactive === true && {
            interactive: true,
          }),
          ...(value.bundle === true && {
            bundle: true,
          }),
          ...(value.handoff === true && {
            handoff: true,
          }),
        };
      if (value.variant === undefined) {
        value2 === -1 &&
          items.push({
            ...state,
            ...(value.disabled === true && {
              disabled: true,
            }),
          });
        continue;
      }
      let value3: Dynamic =
        value.disabled === true
          ? {
              id: value.variant,
              disabled: true,
            }
          : {
              id: value.variant,
            };
      if (value2 === -1)
        items.push({
          ...state,
          variants: [value3],
        });
      else {
        let value4: Dynamic = items[value2];
        value4.variants !== undefined &&
          (items[value2] = {
            ...value4,
            variants: [...value4.variants, value3],
          });
      }
    }
    return items.map(
      (input?: Dynamic): Dynamic =>
        input.variants === undefined
          ? input
          : input.variants.every(
                (input2?: Dynamic): Dynamic => input2.disabled === true,
              )
            ? {
                ...input,
                disabled: true,
                variants: input.variants.map(
                  (input2?: Dynamic): Dynamic => ({
                    id: input2.id,
                  }),
                ),
              }
            : input,
    );
  }
  function scheduleInteractiveExportRelease(
    request?: Dynamic,
    format?: Dynamic,
  ): Dynamic {
    !request.interactive ||
      format.releaseRequestAfterMs === undefined ||
      (request.releaseTimer = setTimeout((): Dynamic => {
        request.releaseTimer = undefined;
        request.released = true;
        (0, runtime.declineFrameExport)(request.request, true);
      }, format.releaseRequestAfterMs));
  }
  function clearExportReleaseTimer(request?: Dynamic): Dynamic {
    request?.releaseTimer !== undefined &&
      (clearTimeout(request.releaseTimer), (request.releaseTimer = undefined));
  }
  function takeQueuedExportRequest(
    format?: Dynamic,
    request?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = queuedExportRequests.get(format),
      value: Dynamic =
        entry === undefined || !exportRequestsCompatible(request, entry)
          ? request
          : entry;
    value === entry && queuedExportRequests.delete(format);
    clearExportReleaseTimer(value);
    return value;
  }
  function isExportOutcomeFinal(result?: Dynamic): Dynamic {
    switch (result.outcome) {
      case "saved":
      case "declined":
        return true;
      case "withheld":
        return false;
      case "unsupported":
        return result.code !== "no_shell_save" && result.code !== "";
    }
  }
  async function runExportProducer(
    format?: Dynamic,
    request?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let { format: value, variant: value2 }: Dynamic = format,
      value3: Dynamic =
        value2 === undefined
          ? {}
          : {
              variant: value2,
            },
      value4: Dynamic;
    try {
      value4 = await format.produce({
        interactive: request.interactive,
        bundle: request.bundle,
        windowMs: request.windowMs,
        ...(request.sender !== undefined && {
          sender: request.sender,
        }),
        signal: options,
      });
    } catch (value9: Dynamic) {
      let value10: Dynamic =
          value9 instanceof Error && value9.name === "ExportCancelled",
        value11: Dynamic = options.aborted
          ? request
          : takeQueuedExportRequest(value, request);
      clearExportReleaseTimer(value11);
      value11.released !== true &&
        (0, runtime.declineFrameExport)(value11.request, value10);
      return value10
        ? {
            format: value,
            ...value3,
            outcome: "declined",
            code: "cancelled",
          }
        : {
            format: value,
            ...value3,
            outcome: "failed",
            code: "producer_failed",
          };
    }
    let value5: Dynamic = takeQueuedExportRequest(value, request);
    if (value5.released === true && options.aborted)
      return {
        format: value,
        ...value3,
        outcome: "unsupported",
        code: "request_unknown",
        filename: value4.filename,
      };
    let value6: Dynamic = value5.released === true,
      value7: Dynamic = value6
        ? await (0, runtime.saveThroughHost)(value4.data, value4.filename)
        : await (0, runtime.saveThroughHost)(value4.data, value4.filename, {
            request: value5.request,
          });
    !value6 &&
      !options.aborted &&
      request.interactive &&
      format.releaseRequestAfterMs !== undefined &&
      value7.outcome === "unsupported" &&
      value7.code === "request_unknown" &&
      ((value7 = await (0, runtime.saveThroughHost)(
        value4.data,
        value4.filename,
      )),
      (value6 = true));
    !value6 &&
      !isExportOutcomeFinal(value7) &&
      (0, runtime.declineFrameExport)(value5.request);
    let value8: Dynamic =
      value7.outcome === "saved" ? "delivered" : value7.outcome;
    return {
      format: value,
      ...value3,
      outcome: value8,
      code: value7.code,
      filename: value4.filename,
      ...(value6 && {
        late: {
          saved: value7,
          file: value4,
        },
      }),
    };
  }
  function enabledExportFormat(format?: Dynamic, variant?: Dynamic): Dynamic {
    let value: Dynamic =
      variant === undefined
        ? registeredExportFormats?.find(
            (input?: Dynamic): Dynamic => input.format === format,
          )
        : registeredExportFormats?.find(
            (input?: Dynamic): Dynamic =>
              input.format === format && input.variant === variant,
          );
    return value !== undefined && value.disabled !== true ? value : undefined;
  }
  async function receiveExportRequest(
    format?: Dynamic,
    request?: Dynamic,
    interactive?: Dynamic,
    variant?: Dynamic,
    bundle?: Dynamic,
    windowMs?: Dynamic,
    sender?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = enabledExportFormat(format, variant);
    if (value === undefined) {
      variant === undefined &&
        registeredExportFormats?.some(
          (input?: Dynamic): Dynamic =>
            input.format === format && input.variant !== undefined,
        ) === true &&
        (0, runtime.declineFrameExport)(request);
      return;
    }
    let state: Dynamic = {
      request: request,
      interactive: interactive,
      bundle: bundle,
      windowMs: windowMs,
      ...(sender !== undefined && {
        sender: sender,
      }),
      ...(value.variant !== undefined && {
        variant: value.variant,
      }),
    };
    clearExportReleaseTimer(queuedExportRequests.get(format));
    queuedExportRequests.set(format, state);
    scheduleInteractiveExportRelease(state, value);
    let entry: Dynamic = activeExportRequests.get(format);
    if (entry !== undefined) {
      exportRequestsCompatible(entry, state) || entry.abort.abort();
      return;
    }
    try {
      for (;;) {
        let entry3: Dynamic = queuedExportRequests.get(format),
          value2: Dynamic =
            entry3 === undefined
              ? undefined
              : enabledExportFormat(format, entry3.variant);
        if (entry3 === undefined || value2 === undefined) break;
        let controller: Dynamic = new AbortController();
        activeExportRequests.set(format, {
          interactive: entry3.interactive,
          bundle: entry3.bundle,
          windowMs: entry3.windowMs,
          ...(entry3.sender !== undefined && {
            sender: entry3.sender,
          }),
          ...(entry3.variant !== undefined && {
            variant: entry3.variant,
          }),
          abort: controller,
        });
        let value3: Dynamic = await runExportProducer(
          value2,
          entry3,
          controller.signal,
        );
        try {
          registeredExportOptions.onResult?.(value3);
        } catch (value4: Dynamic) {
          typeof reportError == "function"
            ? reportError(value4)
            : console.error(value4);
        }
      }
      let entry2: Dynamic = queuedExportRequests.get(format);
      entry2 !== undefined &&
        (queuedExportRequests.delete(format),
        clearExportReleaseTimer(entry2),
        entry2.released !== true &&
          (0, runtime.declineFrameExport)(entry2.request));
    } finally {
      activeExportRequests.delete(format);
    }
  }
  function onHostExportRequest(
    format?: Dynamic,
    request?: Dynamic,
    interactive?: Dynamic,
    variant?: Dynamic,
    bundle: Dynamic = false,
    windowMs: Dynamic = interactive
      ? interactiveExportWindowMs
      : noninteractiveExportWindowMs,
    sender?: Dynamic,
  ): Dynamic {
    receiveExportRequest(
      format,
      request,
      interactive,
      variant,
      bundle,
      windowMs,
      sender,
    );
  }
  function normalizeExportFormats(formats?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of formats as Dynamic) {
      if (
        !runtime.CanvasMeasurementsPattern.test(value.format) ||
        (value.variant !== undefined &&
          (value.handoff === true ||
            !runtime.CanvasMeasurementsPattern_2.test(value.variant)))
      )
        continue;
      let value2: Dynamic = items.find(
        (input?: Dynamic): Dynamic => input.format === value.format,
      );
      (value2 !== undefined &&
        (value2.variant === undefined ||
          value.variant === undefined ||
          (value2.interactive === true) != (value.interactive === true) ||
          (value2.bundle === true) != (value.bundle === true) ||
          items.some(
            (input?: Dynamic): Dynamic =>
              input.format === value.format && input.variant === value.variant,
          ))) ||
        items.push(value);
    }
    return items;
  }
  function registerExportFormats(
    formats?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = normalizeExportFormats(formats);
    registeredExportFormats = value;
    registeredExportOptions = options;
    (0, runtime.setFrameExportHandler)(onHostExportRequest);
    (0, runtime.setFrameExports)(exportCapabilitiesByFormat(value));
    return (): Dynamic => {
      if (registeredExportFormats === value) {
        registeredExportFormats = null;
        registeredExportOptions = {};
        for (let value2 of queuedExportRequests.values() as Dynamic) {
          clearExportReleaseTimer(value2);
          value2.released !== true &&
            (0, runtime.declineFrameExport)(value2.request);
        }
        queuedExportRequests.clear();
        for (let value2 of activeExportRequests.values() as Dynamic)
          value2.abort.abort();
        (0, runtime.setFrameExports)(null);
        (0, runtime.setFrameExportHandler)(null);
      }
    };
  }
  function useExportFormats(formats?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, react_DB.useRef)({
      entries: formats,
      opts: options,
    });
    value.current = {
      entries: formats,
      opts: options,
    };
    let value2: Dynamic = (0, react_DB.useRef)(null),
      value3: Dynamic =
        formats === null
          ? ""
          : JSON.stringify([
              exportCapabilitiesByFormat(formats),
              formats.map(
                (input?: Dynamic): Dynamic =>
                  input.releaseRequestAfterMs ?? null,
              ),
            ]);
    (0, react_DB.useEffect)((): Dynamic => {
      let { entries: current }: Dynamic = value.current;
      if (current === null) {
        value2.current?.();
        value2.current = null;
        return;
      }
      let value4: Dynamic = current.map(
        (input?: Dynamic): Dynamic => ({
          format: input.format,
          ...(input.variant !== undefined && {
            variant: input.variant,
          }),
          disabled: input.disabled,
          interactive: input.interactive,
          bundle: input.bundle,
          handoff: input.handoff,
          ...(input.releaseRequestAfterMs !== undefined && {
            releaseRequestAfterMs: input.releaseRequestAfterMs,
          }),
          produce: (input2?: Dynamic): Dynamic =>
            (
              value.current.entries?.find(
                (input3?: Dynamic): Dynamic =>
                  input3.format === input.format &&
                  input3.variant === input.variant,
              ) ?? input
            ).produce(input2),
        }),
      );
      value2.current = registerExportFormats(value4, {
        onResult: (input?: Dynamic): Dynamic =>
          value.current.opts?.onResult?.(input),
      });
    }, [value3]);
    (0, react_DB.useEffect)(
      (): Dynamic => (): Dynamic => {
        value2.current?.();
        value2.current = null;
      },
      [],
    );
  }
  bindRuntimeValue(
    runtime,
    "react_Su",
    () => react_Su,
    (value) => {
      react_Su = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "react_DB",
    () => react_DB,
    (value) => {
      react_DB = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noninteractiveExportWindowMs",
    () => noninteractiveExportWindowMs,
    (value) => {
      noninteractiveExportWindowMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "interactiveExportWindowMs",
    () => interactiveExportWindowMs,
    (value) => {
      interactiveExportWindowMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportCancelled",
    () => ExportCancelled,
    (value) => {
      ExportCancelled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registeredExportFormats",
    () => registeredExportFormats,
    (value) => {
      registeredExportFormats = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registeredExportOptions",
    () => registeredExportOptions,
    (value) => {
      registeredExportOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "queuedExportRequests",
    () => queuedExportRequests,
    (value) => {
      queuedExportRequests = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeExportRequests",
    () => activeExportRequests,
    (value) => {
      activeExportRequests = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportRequestsCompatible",
    () => exportRequestsCompatible,
  );
  bindRuntimeValue(
    runtime,
    "exportCapabilitiesByFormat",
    () => exportCapabilitiesByFormat,
  );
  bindRuntimeValue(
    runtime,
    "scheduleInteractiveExportRelease",
    () => scheduleInteractiveExportRelease,
  );
  bindRuntimeValue(
    runtime,
    "clearExportReleaseTimer",
    () => clearExportReleaseTimer,
  );
  bindRuntimeValue(
    runtime,
    "takeQueuedExportRequest",
    () => takeQueuedExportRequest,
  );
  bindRuntimeValue(runtime, "isExportOutcomeFinal", () => isExportOutcomeFinal);
  bindRuntimeValue(runtime, "runExportProducer", () => runExportProducer);
  bindRuntimeValue(runtime, "enabledExportFormat", () => enabledExportFormat);
  bindRuntimeValue(runtime, "receiveExportRequest", () => receiveExportRequest);
  bindRuntimeValue(runtime, "onHostExportRequest", () => onHostExportRequest);
  bindRuntimeValue(
    runtime,
    "normalizeExportFormats",
    () => normalizeExportFormats,
  );
  bindRuntimeValue(
    runtime,
    "registerExportFormats",
    () => registerExportFormats,
  );
  bindRuntimeValue(runtime, "useExportFormats", () => useExportFormats);
  return () => {
    react_Su = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeButtonButton)();
    (0, runtime.initializeComponentsIcon_2)();
    (0, runtime.initializeComponentsSelectionRing_5)();
    react_DB = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    noninteractiveExportWindowMs = 6e4;
    interactiveExportWindowMs = 5 * 6e4;
    ExportCancelled = class extends Error {
      declare name: Dynamic;
      constructor() {
        super("export cancelled");
        this.name = "ExportCancelled";
      }
    };
    registeredExportFormats = null;
    registeredExportOptions = {};
    queuedExportRequests = new Map();
    activeExportRequests = new Map();
  };
}
