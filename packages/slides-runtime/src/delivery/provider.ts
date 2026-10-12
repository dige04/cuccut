/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type { ShellSaveFile, ShellSaveResult } from "./shell-downloads";

/** Who asked for an export that is not interactive. */
export type HostExportSender = "viewer" | "claude";

/** What an export producer is told about the request it answers. */
export interface ExportProduceOptions {
  interactive: boolean;
  bundle: boolean;
  windowMs: number;
  sender?: HostExportSender;
  /** Aborts when a newer, incompatible request replaces this one. */
  signal: AbortSignal;
}

/** The file an export producer made. */
export interface ExportedFile {
  data: ShellSaveFile;
  filename: string;
}

/** One format (and optional destination variant) the page can export. */
export interface ExportEntry {
  format: string;
  variant?: string;
  disabled?: boolean;
  interactive?: boolean;
  bundle?: boolean;
  handoff?: boolean;
  /** After this long the host's request is released and the file is saved without it. */
  releaseRequestAfterMs?: number;
  produce(options: ExportProduceOptions): ExportedFile | Promise<ExportedFile>;
}

/** How an export request ended. `delivered` means the shell saved the file. */
export interface ExportResult {
  format: string;
  variant?: string;
  outcome: "delivered" | "declined" | "failed" | "unsupported" | "withheld";
  code: string;
  filename?: string;
  /** Present when the file was saved after the host's request was released. */
  late?: { saved: ShellSaveResult; file: ExportedFile };
}

export interface ExportRegistrationOptions {
  onResult?: (result: ExportResult) => void;
}

/** A destination variant of an exported format, as announced to the host. */
export interface HostExportVariantDescriptor {
  id: string;
  disabled?: boolean;
}

/** A format as announced to the host (`setHostExports`). */
export interface HostExportDescriptor {
  format: string;
  interactive?: boolean;
  bundle?: boolean;
  handoff?: boolean;
  disabled?: boolean;
  variants?: HostExportVariantDescriptor[];
}

/** The parts of an export request that decide whether two requests can share one run. */
export interface ExportRequestOptions {
  interactive: boolean;
  bundle: boolean;
  sender?: HostExportSender;
  variant?: string;
  windowMs: number;
}

/** A request from the host that has not been answered yet. */
export interface PendingExportRequest extends ExportRequestOptions {
  /** The host's request id. */
  request: string;
  releaseTimer?: ReturnType<typeof setTimeout>;
  /** The host's request was released early; the file is saved without it. */
  released?: boolean;
}

/** An export that is being produced right now. */
export interface RunningExportRequest extends ExportRequestOptions {
  abort: AbortController;
}

/** Handles an export request message from the host (see host/frame-bridge.ts). */
export type HostExportRequestHandler = (
  format: string,
  request: string,
  interactive: boolean,
  variant: string | undefined,
  bundle: boolean,
  windowMs: number,
  sender: HostExportSender | undefined,
) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    ReactExportProvider: ReactNamespace;
    /** Largest export text the host may be handed inline. */
    MAX_EXPORT_INLINE_CHARS: number;
    DEFAULT_EXPORT_WINDOW_MS: number;
    INTERACTIVE_EXPORT_WINDOW_MS: number;
    ExportCancelledError: new () => Error;
    registeredExportEntries: readonly ExportEntry[] | null;
    registeredExportOptions: ExportRegistrationOptions;
    pendingExportRequests: Map<string, PendingExportRequest>;
    runningExportRequests: Map<string, RunningExportRequest>;
    exportRequestOptionsCompatible: (
      left: ExportRequestOptions,
      right: ExportRequestOptions,
    ) => boolean;
    exportCapabilityDescriptors: (
      entries: readonly ExportEntry[],
    ) => HostExportDescriptor[];
    scheduleExportRequestRelease: (
      request: PendingExportRequest,
      entry: ExportEntry,
    ) => void;
    clearExportRequestReleaseTimer: (
      request: PendingExportRequest | undefined,
    ) => void;
    consumePendingExportRequest: (
      format: string,
      request: PendingExportRequest,
    ) => PendingExportRequest;
    exportDeliveryHandled: (delivery: ShellSaveResult) => boolean;
    produceAndDeliverExport: (
      entry: ExportEntry,
      request: PendingExportRequest,
      attempt: AbortSignal,
    ) => Promise<ExportResult>;
    findExportEntry: (
      format: string,
      variant?: string,
    ) => ExportEntry | undefined;
    dispatchExportRequest: (
      format: string,
      request: string,
      interactive: boolean,
      variant: string | undefined,
      bundle: boolean,
      windowMs: number,
      sender: HostExportSender | undefined,
    ) => Promise<void>;
    handleExportCapabilityRequest: HostExportRequestHandler;
    validateExportEntries: (entries: readonly ExportEntry[]) => ExportEntry[];
    registerExportEntries: (
      entries: readonly ExportEntry[],
      options?: ExportRegistrationOptions,
    ) => () => void;
    useExportEntries: (
      entries: readonly ExportEntry[] | null,
      options?: ExportRegistrationOptions,
    ) => void;
  }
}

export function installDeliveryProvider(runtime: RuntimeBindings): () => void {
  var ReactExportProvider: ReactNamespace;
  var MAX_EXPORT_INLINE_CHARS: number;
  var DEFAULT_EXPORT_WINDOW_MS: number;
  var INTERACTIVE_EXPORT_WINDOW_MS: number;
  var ExportCancelledError: new () => Error;
  var registeredExportEntries: readonly ExportEntry[] | null;
  var registeredExportOptions: ExportRegistrationOptions;
  var pendingExportRequests: Map<string, PendingExportRequest>;
  var runningExportRequests: Map<string, RunningExportRequest>;
  function exportRequestOptionsCompatible(
    left: ExportRequestOptions,
    right: ExportRequestOptions,
  ): boolean {
    return (
      left.interactive === right.interactive &&
      left.bundle === right.bundle &&
      left.sender === right.sender &&
      left.variant === right.variant &&
      left.windowMs <= right.windowMs
    );
  }
  function exportCapabilityDescriptors(
    entries: readonly ExportEntry[],
  ): HostExportDescriptor[] {
    let descriptors: HostExportDescriptor[] = [];
    for (let value of entries) {
      let value2 = descriptors.findIndex(
          (input) => input.format === value.format,
        ),
        state = {
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
        if (value2 === -1) {
          descriptors.push({
            ...state,
            ...(value.disabled === true && {
              disabled: true,
            }),
          });
        }
        continue;
      }
      let value3 =
        value.disabled === true
          ? {
              id: value.variant,
              disabled: true,
            }
          : {
              id: value.variant,
            };
      if (value2 === -1) {
        descriptors.push({
          ...state,
          variants: [value3],
        });
      } else {
        let value4 = descriptors[value2]!;
        if (value4.variants !== undefined) {
          descriptors[value2] = {
            ...value4,
            variants: [...value4.variants, value3],
          };
        }
      }
    }
    return descriptors.map((input) =>
      input.variants === undefined
        ? input
        : input.variants.every((input2) => input2.disabled === true)
          ? {
              ...input,
              disabled: true,
              variants: input.variants.map((input2) => ({
                id: input2.id,
              })),
            }
          : input,
    );
  }
  function scheduleExportRequestRelease(
    request: PendingExportRequest,
    entry: ExportEntry,
  ) {
    if (!request.interactive || entry.releaseRequestAfterMs === undefined) {
      return;
    }
    request.releaseTimer = setTimeout(() => {
      request.releaseTimer = undefined;
      request.released = true;
      (0, runtime.declineHostExport)(request.request, true);
    }, entry.releaseRequestAfterMs);
  }
  function clearExportRequestReleaseTimer(
    request: PendingExportRequest | undefined,
  ) {
    if (request?.releaseTimer === undefined) {
      return;
    }
    clearTimeout(request.releaseTimer);
    request.releaseTimer = undefined;
  }
  function consumePendingExportRequest(
    format: string,
    request: PendingExportRequest,
  ): PendingExportRequest {
    let existing = pendingExportRequests.get(format),
      chosen =
        existing === undefined ||
        !exportRequestOptionsCompatible(request, existing)
          ? request
          : existing;
    if (chosen === existing) {
      pendingExportRequests.delete(format);
    }
    clearExportRequestReleaseTimer(chosen);
    return chosen;
  }
  function exportDeliveryHandled(delivery: ShellSaveResult): boolean {
    switch (delivery.outcome) {
      case "saved":
      case "declined":
        return true;
      case "withheld":
        return false;
      case "unsupported":
        return delivery.code !== "no_shell_save" && delivery.code !== "";
    }
  }
  async function produceAndDeliverExport(
    entry: ExportEntry,
    request: PendingExportRequest,
    attempt: AbortSignal,
  ): Promise<ExportResult> {
    let { format: format, variant: variant } = entry,
      value =
        variant === undefined
          ? {}
          : {
              variant: variant,
            },
      value2: ExportedFile;
    try {
      value2 = await entry.produce({
        interactive: request.interactive,
        bundle: request.bundle,
        windowMs: request.windowMs,
        ...(request.sender !== undefined && {
          sender: request.sender,
        }),
        signal: attempt,
      });
    } catch (value7) {
      let value8 =
          value7 instanceof Error && value7.name === "ExportCancelled",
        value9 = attempt.aborted
          ? request
          : consumePendingExportRequest(format, request);
      clearExportRequestReleaseTimer(value9);
      if (value9.released !== true) {
        (0, runtime.declineHostExport)(value9.request, value8);
      }
      if (value8) {
        return {
          format: format,
          ...value,
          outcome: "declined",
          code: "cancelled",
        };
      } else {
        return {
          format: format,
          ...value,
          outcome: "failed",
          code: "producer_failed",
        };
      }
    }
    let value3 = consumePendingExportRequest(format, request);
    if (value3.released === true && attempt.aborted) {
      return {
        format: format,
        ...value,
        outcome: "unsupported",
        code: "request_unknown",
        filename: value2.filename,
      };
    }
    let value4 = value3.released === true,
      value5 = value4
        ? await (0, runtime.saveThroughShell)(value2.data, value2.filename)
        : await (0, runtime.saveThroughShell)(value2.data, value2.filename, {
            request: value3.request,
          });
    if (
      !value4 &&
      !attempt.aborted &&
      request.interactive &&
      entry.releaseRequestAfterMs !== undefined &&
      value5.outcome === "unsupported" &&
      value5.code === "request_unknown"
    ) {
      value5 = await (0, runtime.saveThroughShell)(
        value2.data,
        value2.filename,
      );
      value4 = true;
    }
    if (!value4 && !exportDeliveryHandled(value5)) {
      (0, runtime.declineHostExport)(value3.request);
    }
    let value6: ExportResult["outcome"] =
      value5.outcome === "saved" ? "delivered" : value5.outcome;
    return {
      format: format,
      ...value,
      outcome: value6,
      code: value5.code,
      filename: value2.filename,
      ...(value4 && {
        late: {
          saved: value5,
          file: value2,
        },
      }),
    };
  }
  function findExportEntry(
    format: string,
    variant?: string,
  ): ExportEntry | undefined {
    let entry =
      variant === undefined
        ? registeredExportEntries?.find((input) => input.format === format)
        : registeredExportEntries?.find(
            (input) => input.format === format && input.variant === variant,
          );
    if (entry !== undefined && entry.disabled !== true) {
      return entry;
    } else {
      return undefined;
    }
  }
  async function dispatchExportRequest(
    format: string,
    request: string,
    interactive: boolean,
    variant: string | undefined,
    bundle: boolean,
    windowMs: number,
    sender: HostExportSender | undefined,
  ): Promise<void> {
    let value = findExportEntry(format, variant);
    if (value === undefined) {
      if (
        variant === undefined &&
        registeredExportEntries?.some(
          (input) => input.format === format && input.variant !== undefined,
        ) === true
      ) {
        (0, runtime.declineHostExport)(request);
      }
      return;
    }
    let state = {
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
    clearExportRequestReleaseTimer(pendingExportRequests.get(format));
    pendingExportRequests.set(format, state);
    scheduleExportRequestRelease(state, value);
    let entry = runningExportRequests.get(format);
    if (entry !== undefined) {
      if (!exportRequestOptionsCompatible(entry, state)) {
        entry.abort.abort();
      }
      return;
    }
    try {
      for (;;) {
        let entry3 = pendingExportRequests.get(format),
          value2 =
            entry3 === undefined
              ? undefined
              : findExportEntry(format, entry3.variant);
        if (entry3 === undefined || value2 === undefined) {
          break;
        }
        let controller = new AbortController();
        runningExportRequests.set(format, {
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
        let value3 = await produceAndDeliverExport(
          value2,
          entry3,
          controller.signal,
        );
        try {
          registeredExportOptions.onResult?.(value3);
        } catch (value4) {
          if (typeof reportError === "function") {
            reportError(value4);
          } else {
            console.error(value4);
          }
        }
      }
      let entry2 = pendingExportRequests.get(format);
      if (entry2 !== undefined) {
        pendingExportRequests.delete(format);
        clearExportRequestReleaseTimer(entry2);
        if (entry2.released !== true) {
          (0, runtime.declineHostExport)(entry2.request);
        }
      }
    } finally {
      runningExportRequests.delete(format);
    }
  }
  function handleExportCapabilityRequest(
    format: string,
    request: string,
    interactive: boolean,
    variant: string | undefined,
    bundle: boolean = false,
    windowMs: number = interactive
      ? INTERACTIVE_EXPORT_WINDOW_MS
      : DEFAULT_EXPORT_WINDOW_MS,
    sender?: HostExportSender,
  ) {
    dispatchExportRequest(
      format,
      request,
      interactive,
      variant,
      bundle,
      windowMs,
      sender,
    );
  }
  function validateExportEntries(
    entries: readonly ExportEntry[],
  ): ExportEntry[] {
    let validEntries: ExportEntry[] = [];
    for (let value of entries) {
      if (!runtime.EXPORT_FORMAT_PATTERN.test(value.format)) {
        continue;
      }
      if (
        value.variant !== undefined &&
        (value.handoff === true ||
          !runtime.HOST_DESTINATION_PATTERN.test(value.variant))
      ) {
        continue;
      }
      let value2 = validEntries.find((input) => input.format === value.format);
      if (
        value2 !== undefined &&
        (value2.variant === undefined ||
          value.variant === undefined ||
          (value2.interactive === true) !== (value.interactive === true) ||
          (value2.bundle === true) !== (value.bundle === true) ||
          validEntries.some(
            (input) =>
              input.format === value.format && input.variant === value.variant,
          ))
      ) {
        continue;
      }
      validEntries.push(value);
    }
    return validEntries;
  }
  function registerExportEntries(
    entries: readonly ExportEntry[],
    options: ExportRegistrationOptions = {},
  ): () => void {
    let validatedEntries = validateExportEntries(entries);
    registeredExportEntries = validatedEntries;
    registeredExportOptions = options;
    (0, runtime.setHostExportHandler)(handleExportCapabilityRequest);
    (0, runtime.setHostExports)(exportCapabilityDescriptors(validatedEntries));
    return () => {
      if (registeredExportEntries !== validatedEntries) {
        return;
      }
      registeredExportEntries = null;
      registeredExportOptions = {};
      for (let value of pendingExportRequests.values())
        if ((clearExportRequestReleaseTimer(value), value.released !== true)) {
          (0, runtime.declineHostExport)(value.request);
        }
      pendingExportRequests.clear();
      for (let value of runningExportRequests.values())
        value.abort.abort();
      (0, runtime.setHostExports)(null);
      (0, runtime.setHostExportHandler)(null);
    };
  }
  function useExportEntries(
    entries: readonly ExportEntry[] | null,
    options?: ExportRegistrationOptions,
  ) {
    let current = ReactExportProvider.useRef({
      entries: entries,
      opts: options,
    });
    current.current = {
      entries: entries,
      opts: options,
    };
    let cleanup = ReactExportProvider.useRef<(() => void) | null>(null),
      descriptorKey =
        entries === null
          ? ""
          : JSON.stringify([
              exportCapabilityDescriptors(entries),
              entries.map((input) => input.releaseRequestAfterMs ?? null),
            ]);
    ReactExportProvider.useEffect(() => {
      let { entries: current2 } = current.current;
      if (current2 === null) {
        cleanup.current?.();
        cleanup.current = null;
        return;
      }
      let value = current2.map(
        (input): ExportEntry => ({
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
          produce: (input2) =>
            (
              current.current.entries?.find(
                (input3) =>
                  input3.format === input.format &&
                  input3.variant === input.variant,
              ) ?? input
            ).produce(input2),
        }),
      );
      cleanup.current = registerExportEntries(value, {
        onResult: (input) => current.current.opts?.onResult?.(input),
      });
    }, [descriptorKey]);
    ReactExportProvider.useEffect(
      () => () => {
        cleanup.current?.();
        cleanup.current = null;
      },
      [],
    );
  }
  bindRuntimeValue(
    runtime,
    "ReactExportProvider",
    () => ReactExportProvider,
    (value) => {
      ReactExportProvider = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_EXPORT_INLINE_CHARS",
    () => MAX_EXPORT_INLINE_CHARS,
    (value) => {
      MAX_EXPORT_INLINE_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_EXPORT_WINDOW_MS",
    () => DEFAULT_EXPORT_WINDOW_MS,
    (value) => {
      DEFAULT_EXPORT_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INTERACTIVE_EXPORT_WINDOW_MS",
    () => INTERACTIVE_EXPORT_WINDOW_MS,
    (value) => {
      INTERACTIVE_EXPORT_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportCancelledError",
    () => ExportCancelledError,
    (value) => {
      ExportCancelledError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registeredExportEntries",
    () => registeredExportEntries,
    (value) => {
      registeredExportEntries = value;
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
    "pendingExportRequests",
    () => pendingExportRequests,
    (value) => {
      pendingExportRequests = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "runningExportRequests",
    () => runningExportRequests,
    (value) => {
      runningExportRequests = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportRequestOptionsCompatible",
    () => exportRequestOptionsCompatible,
  );
  bindRuntimeValue(
    runtime,
    "exportCapabilityDescriptors",
    () => exportCapabilityDescriptors,
  );
  bindRuntimeValue(
    runtime,
    "scheduleExportRequestRelease",
    () => scheduleExportRequestRelease,
  );
  bindRuntimeValue(
    runtime,
    "clearExportRequestReleaseTimer",
    () => clearExportRequestReleaseTimer,
  );
  bindRuntimeValue(
    runtime,
    "consumePendingExportRequest",
    () => consumePendingExportRequest,
  );
  bindRuntimeValue(
    runtime,
    "exportDeliveryHandled",
    () => exportDeliveryHandled,
  );
  bindRuntimeValue(
    runtime,
    "produceAndDeliverExport",
    () => produceAndDeliverExport,
  );
  bindRuntimeValue(runtime, "findExportEntry", () => findExportEntry);
  bindRuntimeValue(
    runtime,
    "dispatchExportRequest",
    () => dispatchExportRequest,
  );
  bindRuntimeValue(
    runtime,
    "handleExportCapabilityRequest",
    () => handleExportCapabilityRequest,
  );
  bindRuntimeValue(
    runtime,
    "validateExportEntries",
    () => validateExportEntries,
  );
  bindRuntimeValue(
    runtime,
    "registerExportEntries",
    () => registerExportEntries,
  );
  bindRuntimeValue(runtime, "useExportEntries", () => useExportEntries);
  return () => {
    ReactExportProvider = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    MAX_EXPORT_INLINE_CHARS = 200000;
    DEFAULT_EXPORT_WINDOW_MS = 60000;
    INTERACTIVE_EXPORT_WINDOW_MS = 300000;
    ExportCancelledError = class ExportCancelledError extends Error {
      declare name: string;
      constructor() {
        super("export cancelled");
        this.name = "ExportCancelled";
      }
    };
    registeredExportEntries = null;
    registeredExportOptions = {};
    pendingExportRequests = new Map();
    runningExportRequests = new Map();
  };
}
