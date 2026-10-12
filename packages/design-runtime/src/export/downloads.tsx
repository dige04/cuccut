/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportDownloads(runtime: RuntimeBindings): () => void {
  var reactExportDownloads: Dynamic;
  var DownloadsArenTAvailableToYouForMessage: Dynamic;
  var ExportDownloadsResolvedValue: Dynamic;
  var ExportDownloadsGifPngJpgSet: Dynamic;
  var ExportDownloadsDocxPptxEpubSet: Dynamic;
  var ExportDownloadsDefaultIgnorablePattern: Dynamic;
  var hasCapabilityMethodValue: Dynamic;
  var ExportDownloadsAlias: Dynamic;
  function normalizeDownloadName(input?: Dynamic): Dynamic {
    let value: Dynamic = input
        .replace(ExportDownloadsDefaultIgnorablePattern, "")
        .replace(/(^|[\s.])\p{M}+/gu, "$1")
        .replace(/[\s.]+$/, ""),
      value2: Dynamic = value.lastIndexOf("."),
      value3: Dynamic =
        value2 === -1 ? "" : value.slice(value2 + 1).toLowerCase();
    return (
      ExportDownloadsGifPngJpgSet.has(value3) ||
      ExportDownloadsDocxPptxEpubSet.has(value3)
    );
  }
  function hasDownloadCapability(): Dynamic {
    return (
      hasCapabilityMethodValue(
        (0, runtime.getCachedHostCapability)("downloads"),
      ) || (0, runtime.hasCapabilityLoader)()
    );
  }
  function downloadsCapabilityDeclared(): Dynamic {
    if (typeof document === "undefined") return false;
    let value: Dynamic = (document as Dynamic)
      .querySelector('meta[name="' + runtime.capabilityMetaName + '"]')
      ?.getAttribute("content");
    if (value == null) return false;
    try {
      let value2: Dynamic = JSON.parse(value);
      return (
        typeof value2 == "object" &&
        value2 !== null &&
        Object.hasOwn(value2, "downloads")
      );
    } catch {
      return false;
    }
  }
  async function downloadsWithheld(
    input: Dynamic = runtime.capabilityTimeoutMs,
  ): Promise<Dynamic> {
    let value: Dynamic;
    try {
      if (!(0, runtime.hasCapabilityLoader)() || !downloadsCapabilityDeclared())
        return false;
      let promise: Dynamic = new Promise(
        (input2?: Dynamic): Dynamic =>
          (value = setTimeout(input2, input, undefined)),
      );
      return (
        (await Promise.race([
          (0, runtime.requestHostCapability)("downloads"),
          promise,
        ])) === null
      );
    } catch {
      return false;
    } finally {
      clearTimeout(value);
    }
  }
  function useDownloadsWithheld(): Dynamic {
    let [value, value2]: Dynamic = (0, reactExportDownloads.useState)(
      ExportDownloadsAlias,
    );
    (0, reactExportDownloads.useEffect)((): Dynamic => {
      let flag: Dynamic = true;
      downloadsWithheld().then((input?: Dynamic): Dynamic => {
        ExportDownloadsAlias = input;
        flag && value2(input);
      });
      return (): Dynamic => {
        flag = false;
      };
    }, []);
    return value;
  }
  function downloadErrorCode(input?: Dynamic): Dynamic {
    if (typeof input == "object" && input !== null && "code" in input) {
      let code: Dynamic = input.code;
      if (typeof code == "string") return code;
    }
    return "";
  }
  async function saveThroughHost(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = {},
  ): Promise<Dynamic> {
    if (await downloadsWithheld())
      return {
        outcome: "withheld",
        code: "withheld",
      };
    let value: Dynamic = await (0, runtime.resolveHostCapability)(
      "downloads",
      hasCapabilityMethodValue,
    );
    if (value === null)
      return {
        outcome: "unsupported",
        code: "no_shell_save",
      };
    try {
      let value2: Dynamic =
        input instanceof Blob ? input : new Uint8Array(input).buffer;
      await value.save(
        context.request === undefined
          ? {
              filename: options,
              data: value2,
            }
          : {
              filename: options,
              data: value2,
              request: context.request,
            },
      );
      return {
        outcome: "saved",
        code: "",
      };
    } catch (value2: Dynamic) {
      let value3: Dynamic = downloadErrorCode(value2);
      return {
        outcome: value3 === "declined" ? "declined" : "unsupported",
        code: value3,
      };
    }
  }
  bindRuntimeValue(
    runtime,
    "reactExportDownloads",
    () => reactExportDownloads,
    (value) => {
      reactExportDownloads = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DownloadsArenTAvailableToYouForMessage",
    () => DownloadsArenTAvailableToYouForMessage,
    (value) => {
      DownloadsArenTAvailableToYouForMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDownloadsResolvedValue",
    () => ExportDownloadsResolvedValue,
    (value) => {
      ExportDownloadsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDownloadsGifPngJpgSet",
    () => ExportDownloadsGifPngJpgSet,
    (value) => {
      ExportDownloadsGifPngJpgSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDownloadsDocxPptxEpubSet",
    () => ExportDownloadsDocxPptxEpubSet,
    (value) => {
      ExportDownloadsDocxPptxEpubSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDownloadsDefaultIgnorablePattern",
    () => ExportDownloadsDefaultIgnorablePattern,
    (value) => {
      ExportDownloadsDefaultIgnorablePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDownloadName",
    () => normalizeDownloadName,
  );
  bindRuntimeValue(
    runtime,
    "hasCapabilityMethodValue",
    () => hasCapabilityMethodValue,
    (value) => {
      hasCapabilityMethodValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasDownloadCapability",
    () => hasDownloadCapability,
  );
  bindRuntimeValue(
    runtime,
    "downloadsCapabilityDeclared",
    () => downloadsCapabilityDeclared,
  );
  bindRuntimeValue(runtime, "downloadsWithheld", () => downloadsWithheld);
  bindRuntimeValue(
    runtime,
    "ExportDownloadsAlias",
    () => ExportDownloadsAlias,
    (value) => {
      ExportDownloadsAlias = value;
    },
  );
  bindRuntimeValue(runtime, "useDownloadsWithheld", () => useDownloadsWithheld);
  bindRuntimeValue(runtime, "downloadErrorCode", () => downloadErrorCode);
  bindRuntimeValue(runtime, "saveThroughHost", () => saveThroughHost);
  return () => {
    reactExportDownloads = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    DownloadsArenTAvailableToYouForMessage =
      "Downloads aren't available to you for this artifact.";
    // CucCut: the original hands the host at most 16 MB. CucCut saves to disk instead of sending, so a file may be as large as a
    // design's own files (256 MB, docs/design/canvas §2); the save bridge allows 512 MB (SAVE_FILE_MAX_BYTES).
    ExportDownloadsResolvedValue = 256 * 1024 * 1024;
    ExportDownloadsGifPngJpgSet = new Set([
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
    ExportDownloadsDocxPptxEpubSet = new Set([
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
    ExportDownloadsDefaultIgnorablePattern =
      /[\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800\uFFFC\u{13441}\u{13442}\u{1D159}\u0000-\u001F\u007F-\u009F]/gu;
    hasCapabilityMethodValue = (0, runtime.hasCapabilityMethod)("save");
  };
}
