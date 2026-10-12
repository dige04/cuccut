/** Restored application module; prepare first, initialize in original order. */
import type * as Migration from "../contracts/migration";
import type * as Model from "../contracts";
import type * as Files from "../contracts/files-core";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesDesignSystemPort(
  runtime: RuntimeBindings & Migration.MigrationRuntime,
): () => void {
  var DAMAGED_FILE_REPLACEMENT_CHARACTER: string;
  var isBinaryProjectFilePath: (path: string) => boolean;
  var isDownloadOnlyPublishInput: (input: Model.FilePublishInput) => boolean;
  var fileMayStayByReference: (
    path: string,
    relative: string,
    lazy?: Files.LazyReadState,
  ) => boolean;
  function createDesignSystemFilesPort(
    port: Model.BrowserFilesPort,
    options: Migration.DesignSystemPortOptions = {},
  ): Migration.DesignSystemFilesPort {
    let extensions = port,
      lazy = options.lazy,
      downloadsRefused = false,
      listingRequestId: number = 0,
      lastListingResponseId = 0,
      lastPublishedVersion = "",
      convertPublishInput = (
        input: string,
        options2: Model.FilePublishInput,
      ):
        | "held"
        | "untyped"
        | "unreadable"
        | {
            value: Model.FilePublishInput;
            bytes?: Uint8Array<ArrayBuffer>;
          } => {
        let value = (0, runtime.relativeProjectFilePath)(input);
        if (
          options2 === null ||
          value === undefined ||
          typeof options2 !== "string"
        ) {
          return {
            value: options2,
          };
        }
        if ((0, runtime.isHeldFilePointer)(value, options2)) {
          return "held";
        }
        let value2 = (0, runtime.publishableFileMimeType)(value, options2);
        if (value2 === null) {
          return "untyped";
        }
        if ((0, runtime.isTextFilePath)(value)) {
          return {
            value: {
              content: options.wireText?.(input, options2) ?? options2,
              contentType: value2,
            },
          };
        }
        let value3 = (0, runtime.decodeHeldFileDataUri)(options2);
        if (value3 === null) {
          return "unreadable";
        }
        return {
          value: (0, runtime.isTextMimeType)(value2)
            ? {
                content: new TextDecoder("utf-8", {
                  ignoreBOM: true,
                }).decode(value3.bytes),
                contentType: value2,
              }
            : {
                content: new Blob([value3.bytes], {
                  type: value2,
                }),
                contentType: value2,
              },
          bytes: value3.bytes,
        };
      },
      referenceSha = (input: string) => {
        let value = (0, runtime.relativeProjectFilePath)(input);
        if (
          value === undefined ||
          !fileMayStayByReference(input, value, lazy) ||
          extensions.wroteSinceAdopt?.(input) !== false
        ) {
          return;
        }
        let value2 = extensions.liveSha?.(input);
        if (
          lazy !== undefined &&
          (0, runtime.isTextFilePath)(value) &&
          lazy.rows.get(input)?.sha256 !== value2
        ) {
          return;
        }
        if (typeof value2 === "string" && value2 !== "") {
          return value2;
        } else {
          return undefined;
        }
      },
      entryProblemDetail = (
        input: string,
        options2: Model.FilePublishInput,
      ): Migration.PublishProblem | undefined => {
        let value = convertPublishInput(input, options2);
        if (value === "held") {
          if (extensions.liveSha?.(input) === null) {
            return {
              why: "its published copy is missing; add the file again",
              cause: "gone",
            };
          } else {
            return undefined;
          }
        }
        if (value === "unreadable") {
          return {
            why: "its contents could not be read; add the file again",
            cause: "unreadable",
          };
        }
        if (value === "untyped") {
          return (
            (0, runtime.explainUnpublishableFile)(
              (0, runtime.relativeProjectFilePath)(input),
              options2 as string,
            ) ?? {
              why: "files of this kind cannot be saved here. Use another format",
              cause: "kind",
            }
          );
        }
        if (downloadsRefused && isDownloadOnlyPublishInput(value.value)) {
          return {
            why: "Word, PowerPoint, Excel, zip and .fig files cannot be saved here at the moment. Keep your own copy of it; to try again later, reload this page and add it again",
            cause: "kind",
            forNow: true,
          };
        }
        if (
          value.value !== null &&
          typeof value.value === "object" &&
          (value.value as { contentType?: unknown }).contentType ===
            "application/zip+dotlottie"
        ) {
          return {
            why: "a packed .lottie archive cannot be saved here yet. Export the animation as Lottie JSON instead",
            cause: "kind",
          };
        }
        return (0, runtime.filePublishRejection)(input, value.value);
      },
      adapter: Migration.DesignSystemFilesPort = {
        list: () => {
          if (lazy === undefined) {
            return port.list();
          }
          let value = ++listingRequestId;
          return port.list().then((input) => {
            if (value > lastListingResponseId) {
              lastListingResponseId = value;
              (0, runtime.updateLazyReadListing)(lazy, input);
            }
            return input;
          });
        },
        readBytes: (input) => port.readBytes(input),
        answersByReference: (input) =>
          referenceSha(input) !== undefined ||
          (lazy !== undefined &&
            (0, runtime.lazyFileReadMode)(lazy, input) === "skipped"),
        async readText(input: string): Promise<Model.FileTextRead> {
          if (
            !isBinaryProjectFilePath(input) &&
            referenceSha(input) === undefined
          ) {
            let value5 = await port.readText(input),
              value6 =
                options.tableText === undefined
                  ? value5
                  : {
                      text: options.tableText(input, value5.text),
                      sha256: value5.sha256,
                    };
            try {
              options.onReadText?.(input, value6.text, value6.sha256);
            } catch {}
            return value6;
          }
          let value = referenceSha(input);
          if (value !== undefined) {
            try {
              options.onReadText?.(input, (0, runtime.filePointer)(), value);
            } catch {}
            return {
              text: (0, runtime.filePointer)(),
              sha256: value,
            };
          }
          let value2 = await port.readBytes(input),
            value3 =
              (0, runtime.publishableFileMimeType)(
                (0, runtime.relativeProjectFilePath)(input),
              ) ?? "application/octet-stream",
            value4 = (0, runtime.bytesToFileDataUri)(value2.bytes, value3);
          try {
            options.onReadText?.(input, value4, value2.sha256);
          } catch {}
          return {
            text: value4,
            sha256: value2.sha256,
          };
        },
        async publish(
          input: Model.FilePublishEntries,
          options2?: Model.FilePublishPreconditions,
        ): Promise<Model.FilePublishResult> {
          if (lazy !== undefined) {
            return {
              ok: false,
              code: "not_writer",
            };
          }
          let state: Model.FilePublishEntries = {},
            state2: Record<string, Promise<string>> = {},
            state3: Record<string, string> = {},
            items: string[] = [];
          for (let [value3, value4] of Object.entries(input)) {
            let value5 = convertPublishInput(value3, value4);
            if (value5 === "held") {
              let value6 = extensions.liveSha?.(value3),
                value7 = options2?.ifMatch?.[value3];
              if (typeof value6 === "string" && value6 !== "") {
                state3[value3] = value6;
              } else if (value6 !== null && typeof value7 === "string") {
                state3[value3] = value7;
              }
              items.push(value3);
              continue;
            }
            if (value5 === "untyped" || value5 === "unreadable") {
              return {
                ok: false,
                code: "invalid_content",
              };
            }
            state[value3] = value5.value;
            if (value5.bytes !== undefined) {
              state2[value3] = (0, runtime.sha256)(value5.bytes);
            }
          }
          let state4: Record<string, string | null> = {};
          for (let [value3, value4] of Object.entries(input)) {
            if (
              (value4 === null || typeof value4 === "string") &&
              !items.includes(value3)
            ) {
              state4[value3] = value4;
            }
          }
          try {
            options.onSend?.(state4);
          } catch {}
          let value: Model.FilePublishResult =
            items.length > 0 && Object.keys(state).length === 0
              ? {
                  ok: true,
                  version: lastPublishedVersion,
                  unchanged: true,
                  shas: {},
                }
              : await port.publish(state, options2);
          if (
            value.ok &&
            Object.keys(state).length > 0 &&
            value.version !== ""
          ) {
            lastPublishedVersion = value.version;
          }
          let value2 =
            value.ok && value.shas !== undefined
              ? {
                  ...value,
                  shas: {
                    ...state3,
                    ...value.shas,
                  },
                }
              : value;
          if (!value2.ok && value2.code === "invalid_content") {
            let value3 = Object.values(state).some(isDownloadOnlyPublishInput);
            if (value3 && !downloadsRefused) {
              try {
                options.onDownloadsRefused?.();
              } catch {}
            }
            downloadsRefused = value3;
          }
          let callback = (input2?: Record<string, string>): void => {
            try {
              options.onPublish?.({
                paths: Object.keys(state),
                ok: value2.ok,
                ...(items.length > 0
                  ? {
                      held: items,
                    }
                  : {}),
                ...(value2.ok
                  ? {
                      version: value2.version,
                      texts: state4,
                      ...(input2 !== undefined
                        ? {
                            shas: input2,
                          }
                        : {}),
                    }
                  : {
                      code: value2.code,
                    }),
              });
            } catch {}
          };
          if (!value2.ok || value2.shas !== undefined) {
            callback(value2.ok ? value2.shas : undefined);
            return value2;
          }
          let state5 = {
            ...state3,
          };
          for (let [value3, value4] of Object.entries(state2)) {
            state5[value3] = await value4;
          }
          for (let [value3, value4] of Object.entries(state)) {
            if (value4 !== null && state5[value3] === undefined) {
              state5[value3] = await (0, runtime.sha256)(
                (
                  new TextEncoder().encode as (
                    input: unknown,
                  ) => Uint8Array<ArrayBuffer>
                )(
                  typeof value4 === "string"
                    ? value4
                    : (value4 as { content?: unknown }).content,
                ),
              );
            }
          }
          callback(state5);
          return {
            ...value2,
            shas: state5,
          };
        },
        onRemoteChange: (input) => port.onRemoteChange(input),
        get canWrite() {
          return port.canWrite;
        },
        get narrowed() {
          return port.narrowed;
        },
        get mayWrite() {
          return port.mayWrite;
        },
        version: () => port.version(),
        entryProblem: (input, options2) =>
          entryProblemDetail(input, options2)?.why,
        entryProblemDetail: entryProblemDetail,
      };
    if (typeof extensions.liveSha === "function") {
      adapter.liveSha = (input) => extensions.liveSha!(input);
    }
    if (typeof extensions.heldSha === "function") {
      adapter.heldSha = (input) => extensions.heldSha!(input);
    }
    if (typeof extensions.noteRemote === "function") {
      adapter.noteRemote = (input) => extensions.noteRemote!(input);
    }
    if (typeof extensions.noteAdopted === "function") {
      adapter.noteAdopted = (input, options2) =>
        extensions.noteAdopted!(input, options2);
    }
    if (typeof extensions.knownListing === "function") {
      adapter.knownListing = () => extensions.knownListing!();
    }
    if (typeof extensions.forgetBootListing === "function") {
      adapter.forgetBootListing = () => extensions.forgetBootListing!();
    }
    if (typeof extensions.listUnlessNarrowed === "function") {
      adapter.listUnlessNarrowed = () => extensions.listUnlessNarrowed!();
    }
    if (typeof extensions.primeRead === "function") {
      adapter.primeRead = (input, options2) =>
        extensions.primeRead!(input, options2);
    }
    if (typeof extensions.noteIncoming === "function") {
      adapter.noteIncoming = (input) => extensions.noteIncoming!(input);
    }
    if (typeof extensions.olderThanMyWrite === "function") {
      adapter.olderThanMyWrite = (input, options2) =>
        extensions.olderThanMyWrite!(input, options2);
    }
    if (typeof extensions.wroteSinceAdopt === "function") {
      adapter.wroteSinceAdopt = (input) => extensions.wroteSinceAdopt!(input);
    }
    return adapter;
  }
  bindRuntimeValue(
    runtime,
    "DAMAGED_FILE_REPLACEMENT_CHARACTER",
    () => DAMAGED_FILE_REPLACEMENT_CHARACTER,
    (value) => {
      DAMAGED_FILE_REPLACEMENT_CHARACTER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isBinaryProjectFilePath",
    () => isBinaryProjectFilePath,
    (value) => {
      isBinaryProjectFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDownloadOnlyPublishInput",
    () => isDownloadOnlyPublishInput,
    (value) => {
      isDownloadOnlyPublishInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileMayStayByReference",
    () => fileMayStayByReference,
    (value) => {
      fileMayStayByReference = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createDesignSystemFilesPort",
    () => createDesignSystemFilesPort,
  );
  return () => {
    DAMAGED_FILE_REPLACEMENT_CHARACTER = String.fromCharCode(65533);
    isBinaryProjectFilePath = (input) => {
      let value = (0, runtime.relativeProjectFilePath)(input);
      return value !== undefined && !(0, runtime.isTextFilePath)(value);
    };
    isDownloadOnlyPublishInput = (input) =>
      input !== null &&
      typeof input === "object" &&
      !(input instanceof Blob) &&
      runtime.FILE_BINARY_MIME_TYPES.has(input.contentType ?? "");
    fileMayStayByReference = (input, options, context) =>
      (0, runtime.canUseHeldFilePointer)(options) &&
      (context === undefined
        ? (0, runtime.assetKindForPath)(options) !== "video"
        : (0, runtime.lazyFileReadMode)(context, input) === "held");
  };
}
