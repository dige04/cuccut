/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type { HostCapabilityValidator } from "../environment/host-capabilities";

/** What happened to an exported file once it was handed to delivery. */
export type ExportDeliveryResult = "saved" | "unsupported" | "declined" | "withheld";

/** The file bytes handed to the shell: a blob, or raw bytes that are copied into an ArrayBuffer. */
export type ShellSaveFile = Blob | ArrayBuffer | ArrayLike<number>;
/** What the shell's `downloads.save` receives. */
export interface ShellSaveRequest {
  filename: string;
  data: Blob | ArrayBufferLike;
  /** The host's pending export request this save answers. */
  request?: unknown;
}
/** The shell's `downloads` capability (not part of the declared SlidesHost surface). */
export interface DownloadsCapability {
  save(request: ShellSaveRequest): Promise<unknown>;
}
export interface ShellSaveOptions {
  request?: unknown;
}
/** How a save through the shell ended; `code` names why when it was not saved. */
export interface ShellSaveResult {
  outcome: ExportDeliveryResult;
  code: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactDownloadsPermission: ReactNamespace;
    DOWNLOADS_UNAVAILABLE_MESSAGE: string;
    MAX_SHELL_DOWNLOAD_BYTES: number;
    supportsShellSave: HostCapabilityValidator<DownloadsCapability>;
    pageDeclaresDownloads: () => boolean;
    downloadsWithheld: (timeoutMs?: number) => Promise<boolean>;
    /** Last answer of `downloadsWithheld`; undefined until the first check has finished. */
    cachedDownloadsWithheld: boolean | undefined;
    useDownloadsWithheld: () => boolean | undefined;
    shellSaveErrorCode: (error: unknown) => string;
    saveThroughShell: (
      file: ShellSaveFile,
      filename: string,
      options?: ShellSaveOptions,
    ) => Promise<ShellSaveResult>;
  }
}

export function installDeliveryShellDownloads(
  runtime: RuntimeBindings,
): () => void {
  var ReactDownloadsPermission: ReactNamespace;
  var DOWNLOADS_UNAVAILABLE_MESSAGE: string;
  var MAX_SHELL_DOWNLOAD_BYTES: number;
  var supportsShellSave: HostCapabilityValidator<DownloadsCapability>;
  var cachedDownloadsWithheld: boolean | undefined;
  function pageDeclaresDownloads() {
    if (typeof document === "undefined") {
      return false;
    }
    let value = document
      .querySelector(
        'meta[name="' + runtime.compiledPageCapabilitiesMetaName + '"]',
      )
      ?.getAttribute("content");
    if (value == null) {
      return false;
    }
    try {
      let value2 = JSON.parse(value);
      return (
        typeof value2 === "object" &&
        value2 !== null &&
        Object.hasOwn(value2, "downloads")
      );
    } catch {
      return false;
    }
  }
  async function downloadsWithheld(
    input: number = runtime.capabilityLoadTimeoutMs,
  ): Promise<boolean> {
    let value: ReturnType<typeof setTimeout> | undefined;
    try {
      if (
        !(0, runtime.hasHostCapabilityLoader)() ||
        !pageDeclaresDownloads()
      ) {
        return false;
      }
      let promise = new Promise<undefined>(
        (input2) =>
          (value = setTimeout(input2, input, undefined)),
      );
      return (
        (await Promise.race([
          (0, runtime.loadHostCapability)("downloads"),
          promise,
        ])) === null
      );
    } catch {
      return false;
    } finally {
      clearTimeout(value);
    }
  }
  function useDownloadsWithheld() {
    let [value, value2] = ReactDownloadsPermission.useState(
      cachedDownloadsWithheld,
    );
    ReactDownloadsPermission.useEffect(() => {
      let flag = true;
      downloadsWithheld().then((input) => {
        cachedDownloadsWithheld = input;
        if (flag) {
          value2(input);
        }
      });
      return () => {
        flag = false;
      };
    }, []);
    return value;
  }
  function shellSaveErrorCode(error: unknown): string {
    if (typeof error === "object" && error !== null && "code" in error) {
      let code = error.code;
      if (typeof code === "string") {
        return code;
      }
    }
    return "";
  }
  async function saveThroughShell(
    file: ShellSaveFile,
    filename: string,
    options: ShellSaveOptions = {},
  ): Promise<ShellSaveResult> {
    if (await downloadsWithheld()) {
      return {
        outcome: "withheld",
        code: "withheld",
      };
    }
    let downloads = await (0, runtime.getOrLoadHostCapability)(
      "downloads",
      supportsShellSave,
    );
    if (downloads === null) {
      return {
        outcome: "unsupported",
        code: "no_shell_save",
      };
    }
    try {
      let value =
        file instanceof Blob ? file : new Uint8Array(file).buffer;
      await downloads.save(
        options.request === undefined
          ? {
              filename: filename,
              data: value,
            }
          : {
              filename: filename,
              data: value,
              request: options.request,
            },
      );
      return {
        outcome: "saved",
        code: "",
      };
    } catch (value) {
      let value2 = shellSaveErrorCode(value);
      return {
        outcome: value2 === "declined" ? "declined" : "unsupported",
        code: value2,
      };
    }
  }
  bindRuntimeValue(
    runtime,
    "ReactDownloadsPermission",
    () => ReactDownloadsPermission,
    (value) => {
      ReactDownloadsPermission = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DOWNLOADS_UNAVAILABLE_MESSAGE",
    () => DOWNLOADS_UNAVAILABLE_MESSAGE,
    (value) => {
      DOWNLOADS_UNAVAILABLE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SHELL_DOWNLOAD_BYTES",
    () => MAX_SHELL_DOWNLOAD_BYTES,
    (value) => {
      MAX_SHELL_DOWNLOAD_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsShellSave",
    () => supportsShellSave,
    (value) => {
      supportsShellSave = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pageDeclaresDownloads",
    () => pageDeclaresDownloads,
  );
  bindRuntimeValue(runtime, "downloadsWithheld", () => downloadsWithheld);
  bindRuntimeValue(
    runtime,
    "cachedDownloadsWithheld",
    () => cachedDownloadsWithheld,
    (value) => {
      cachedDownloadsWithheld = value;
    },
  );
  bindRuntimeValue(runtime, "useDownloadsWithheld", () => useDownloadsWithheld);
  bindRuntimeValue(runtime, "shellSaveErrorCode", () => shellSaveErrorCode);
  bindRuntimeValue(runtime, "saveThroughShell", () => saveThroughShell);
  return () => {
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeCompiledPage)();
    ReactDownloadsPermission = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    DOWNLOADS_UNAVAILABLE_MESSAGE =
      "Downloads aren't available to you for this artifact.";
    MAX_SHELL_DOWNLOAD_BYTES = 16777216;
    supportsShellSave = (0, runtime.capabilityHasMethod)("save");
  };
}
