import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorDownloadPermission(
  runtime: RuntimeBindings,
): () => void {
  var ReactDownloadsPermission: typeof React;
  var DOWNLOADS_UNAVAILABLE_MESSAGE: string;
  var SHELL_DIRECT_DOWNLOAD_EXTENSIONS: Set<string>;
  var SHELL_BINARY_DOWNLOAD_EXTENSIONS: Set<string>;
  var DOWNLOAD_NAME_IGNORABLE_PATTERN: RegExp;
  var supportsShellSave: (
    capability: unknown,
  ) => capability is Editor.DownloadCapability;
  var cachedDownloadsWithheld: boolean | undefined;
  function normalizeDownloadName(name: string): boolean {
    let value = name
        .replace(DOWNLOAD_NAME_IGNORABLE_PATTERN, "")
        .replace(/(^|[\s.])\p{M}+/gu, "$1")
        .replace(/[\s.]+$/, ""),
      value2 = value.lastIndexOf("."),
      value3 = value2 === -1 ? "" : value.slice(value2 + 1).toLowerCase();
    return (
      SHELL_DIRECT_DOWNLOAD_EXTENSIONS.has(value3) ||
      SHELL_BINARY_DOWNLOAD_EXTENSIONS.has(value3)
    );
  }
  function hasDownloadCapability(): boolean {
    return (
      supportsShellSave((0, runtime.getClaudeCapability)("downloads")) ||
      (0, runtime.hasClaudeCapabilityLoader)()
    );
  }
  function pageDeclaresDownloads(): boolean {
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
      let value2: unknown = JSON.parse(value);
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
  ): Promise<boolean | undefined> {
    let value: ReturnType<typeof setTimeout> | undefined;
    try {
      if (
        !(0, runtime.hasClaudeCapabilityLoader)() ||
        !pageDeclaresDownloads()
      ) {
        return false;
      }
      let promise = new Promise<undefined>(
        (input2) => (value = setTimeout(input2, input, undefined)),
      );
      return (
        (await Promise.race([
          (0, runtime.loadClaudeCapability)("downloads"),
          promise,
        ])) === null
      );
    } catch {
      return false;
    } finally {
      clearTimeout(value);
    }
  }
  function useDownloadsWithheld(): boolean | undefined {
    let [value, value2] = ReactDownloadsPermission.useState(
      cachedDownloadsWithheld,
    );
    ReactDownloadsPermission.useEffect(() => {
      let flag: boolean = true;
      downloadsWithheld().then((input): void => {
        cachedDownloadsWithheld = input;
        if (flag) {
          value2(input);
        }
      });
      return (): void => {
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
    name: Editor.ShellSaveData,
    bytes: string,
    options: {
      request?: unknown;
    } = {},
  ): Promise<Application.ShellSaveResult> {
    if (await downloadsWithheld()) {
      return {
        outcome: "withheld",
        code: "withheld",
      };
    }
    let value: Editor.DownloadCapability | null = await (0,
    runtime.getOrLoadClaudeCapability)("downloads", supportsShellSave);
    if (value === null) {
      return {
        outcome: "unsupported",
        code: "no_shell_save",
      };
    }
    try {
      let value2 =
        name instanceof Blob
          ? name
          : new Uint8Array(name as ArrayBuffer).buffer;
      await value.save(
        options.request === undefined
          ? {
              filename: bytes,
              data: value2,
            }
          : {
              filename: bytes,
              data: value2,
              request: options.request,
            },
      );
      return {
        outcome: "saved",
        code: "",
      };
    } catch (value2) {
      let value3 = shellSaveErrorCode(value2);
      return {
        outcome: value3 === "declined" ? "declined" : "unsupported",
        code: value3,
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
    "SHELL_DIRECT_DOWNLOAD_EXTENSIONS",
    () => SHELL_DIRECT_DOWNLOAD_EXTENSIONS,
    (value) => {
      SHELL_DIRECT_DOWNLOAD_EXTENSIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHELL_BINARY_DOWNLOAD_EXTENSIONS",
    () => SHELL_BINARY_DOWNLOAD_EXTENSIONS,
    (value) => {
      SHELL_BINARY_DOWNLOAD_EXTENSIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DOWNLOAD_NAME_IGNORABLE_PATTERN",
    () => DOWNLOAD_NAME_IGNORABLE_PATTERN,
    (value) => {
      DOWNLOAD_NAME_IGNORABLE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDownloadName",
    () => normalizeDownloadName,
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
    "hasDownloadCapability",
    () => hasDownloadCapability,
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
    ReactDownloadsPermission = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    DOWNLOADS_UNAVAILABLE_MESSAGE =
      "Downloads aren't available to you for this artifact.";
    SHELL_DIRECT_DOWNLOAD_EXTENSIONS = new Set([
      "gif",
      "png",
      "jpg",
      "jpeg",
      "webp",
      "mp4",
      "webm",
      "txt",
      "json",
      "md",
    ]);
    SHELL_BINARY_DOWNLOAD_EXTENSIONS = new Set([
      "docx",
      "pptx",
      "epub",
      "csv",
      "ttf",
      "html",
      "svg",
      "pdf",
      "xlsx",
      "zip",
    ]);
    DOWNLOAD_NAME_IGNORABLE_PATTERN =
      /[\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800\uFFFC\u{13441}\u{13442}\u{1D159}\u0000-\u001F\u007F-\u009F]/gu;
    supportsShellSave = (0, runtime.capabilityHasMethod)("save") as (
      capability: unknown,
    ) => capability is Editor.DownloadCapability;
  };
}
