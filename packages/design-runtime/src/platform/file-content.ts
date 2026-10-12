/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPlatformFileContent(
  runtime: RuntimeBindings,
): () => void {
  var PlatformFileContentLimit: Dynamic;
  var PlatformFileContentLimit_2: Dynamic;
  var PlatformFileContentResolvedValue: Dynamic;
  var PlatformFileContentFilesBytesConfig: Dynamic;
  var PlatformFileContentResolvedValue_2: Dynamic;
  var PlatformFileContentCache: Dynamic;
  var PlatformFileContentSubscribers: Dynamic;
  var PlatformFileContentSubscribers_2: Dynamic;
  var PlatformFileContentSubscribers_3: Dynamic;
  var Value_2: Dynamic;
  var PlatformFileContentUDBFFUDFFFPattern: Dynamic;
  var PlatformFileContentIncludes: Dynamic;
  var isHtmlPath: Dynamic;
  var frameRuntimeStartMarker: Dynamic;
  var frameRuntimeEndMarker: Dynamic;
  var getFileContent: Dynamic;
  var encodePathSegments: Dynamic;
  var canvasMetadataFile: Dynamic;
  var PlatformFileContentLabel: Dynamic;
  var PlatformFileContentGridSizeCountSizeConfig: Dynamic;
  var PlatformFileContentConstant: Dynamic;
  var PlatformFileContentPattern: Dynamic;
  var PlatformFileContentExpandPrintPaperValues: Dynamic;
  var PlatformFileContentLimit_3: Dynamic;
  var PlatformFileContentLimitAlias: Dynamic;
  var PlatformFileContentBackgroundBackgroundColorOpacityValues: Dynamic;
  var PlatformFileContentPattern_2: Dynamic;
  var PlatformFileContentAZPattern: Dynamic;
  var PlatformFileContentRgbaHslaPattern: Dynamic;
  var PlatformFileContentBorderStyleObjectFitOpacityConfig: Dynamic;
  var PlatformFileContentTrim: Dynamic;
  var annotationArrowHeads: Dynamic;
  var normalizeAnnotationCss: Dynamic;
  var isShapeAnnotation: Dynamic;
  var annotationRotation: Dynamic;
  var PlatformFileContentSMLConfig: Dynamic;
  var PlatformFileContentConstant_2: Dynamic;
  var PlatformFileContentConstant_3: Dynamic;
  var PlatformFileContentConstant_4: Dynamic;
  var PlatformFileContentGrayRedOrangeValues: Dynamic;
  var PlatformFileContentGrayRedOrangeValuesAlias: Dynamic;
  var PlatformFileContentNoteTitle1Config: Dynamic;
  var annotationTextStyle: Dynamic;
  var PlatformFileContentHas: Dynamic;
  var PlatformFileContentMax: Dynamic;
  var PlatformFileContentKind: Dynamic;
  var PlatformFileContentMaxW: Dynamic;
  var PlatformFileContentHandler: Dynamic;
  var PlatformFileContentKind_2: Dynamic;
  var validCoverArtboard: Dynamic;
  var artboardNameWithoutExtension: Dynamic;
  var PlatformFileContentConstant_5: Dynamic;
  var PlatformFileContentConstant_6: Dynamic;
  var PlatformFileContentConstant_7: Dynamic;
  var PlatformFileContentConstant_8: Dynamic;
  var PlatformFileContentConstant_9: Dynamic;
  var PlatformFileContentConstant_10: Dynamic;
  var PlatformFileContentConstant_11: Dynamic;
  var PlatformFileContentConstant_12: Dynamic;
  var PlatformFileContentConstant_13: Dynamic;
  var PlatformFileContentConstant_14: Dynamic;
  var PlatformFileContentMin: Dynamic;
  var PlatformFileContentLh: Dynamic;
  var PlatformFileContentMax_2: Dynamic;
  var PlatformFileContentMatch: Dynamic;
  var PlatformFileContentL: Dynamic;
  var PlatformFileContentTest: Dynamic;
  var PlatformFileContentLimit_4: Dynamic;
  var PlatformFileContentLimit_5: Dynamic;
  var PlatformFileContentConstant_15: Dynamic;
  var PlatformFileContentConstant_16: Dynamic;
  var PlatformFileContentConstant_17: Dynamic;
  var PlatformFileContentLimit_6: Dynamic;
  var PlatformFileContentResolvedValue_3: Dynamic;
  var PlatformFileContentConstant_18: Dynamic;
  var PlatformFileContentRectOvalLineConfig: Dynamic;
  var PlatformFileContentConstant_19: Dynamic;
  var PlatformFileContentConstant_20: Dynamic;
  var PlatformFileContentTest_2: Dynamic;
  var PlatformFileContentTest_3: Dynamic;
  var PlatformFileContentLimit_7: Dynamic;
  var PlatformFileContentTrim_2: Dynamic;
  var PlatformFileContentMin_2: Dynamic;
  var PlatformFileContentConstant_21: Dynamic;
  var PlatformFileContentSlice: Dynamic;
  var PlatformFileContentSlice_2: Dynamic;
  var PlatformFileContentTest_4: Dynamic;
  var PlatformFileContentHandler_2: Dynamic;
  var PlatformFileContentIncludes_2: Dynamic;
  var PlatformFileContentIncludes_3: Dynamic;
  var PlatformFileContentHandler_3: Dynamic;
  var normalizeDesignLaunch: Dynamic;
  var PlatformFileContentScriptDataPropsPattern: Dynamic;
  var artboardDisplayName: Dynamic;
  var annotationKindCategory: Dynamic;
  var DesignValue: Dynamic;
  var MetaValue: Dynamic;
  var PlatformFileContentResolvedValue_4: Dynamic;
  var SourceValue: Dynamic;
  var PlatformFileContentResolvedValue_5: Dynamic;
  var BoardsValue: Dynamic;
  var FilesValue: Dynamic;
  var NotesValue: Dynamic;
  var PlatformFileContentResolvedValue_6: Dynamic;
  var PlatformFileContentResolvedValue_7: Dynamic;
  var PlatformFileContentResolvedValue_8: Dynamic;
  var PlatformFileContentResolvedValue_9: Dynamic;
  var PlatformFileContentWebpAvifPattern: Dynamic;
  var PlatformFileContentNodeModulesPattern: Dynamic;
  var PlatformFileContentJsonPattern: Dynamic;
  var PlatformFileContentLimit_8: Dynamic;
  var PlatformFileContentAZaZAZaZPattern: Dynamic;
  var PlatformFileContentPattern_3: Dynamic;
  var ProjectValue: Dynamic;
  var PlatformFileContentPattern_4: Dynamic;
  var PlatformFileContentResolvedValue_10: Dynamic;
  var PlatformFileContentAZaZPattern: Dynamic;
  var PlatformFileContentTextEncoder: Dynamic;
  var PlatformFileContentXYWValues: Dynamic;
  var ClaudeDesignValue: Dynamic;
  var PlatformFileContentLimit_9: Dynamic;
  var PlatformFileContentAZaZPattern_2: Dynamic;
  var DesignPValue: Dynamic;
  var PlatformFileContentPattern_5: Dynamic;
  var PlatformFileContentFilesValue: Dynamic;
  var PlatformFileContentResolvedValue_11: Dynamic;
  var PlatformFileContentLimit_10: Dynamic;
  var PlatformFileContentTextEncoder_2: Dynamic;
  var PlatformFileContentTextEncoder_3: Dynamic;
  var FileValue: Dynamic;
  var PlatformFileContentOverPerFilePattern: Dynamic;
  var PlatformFileContentHandler_4: Dynamic;
  var PlatformFileContentAlias: Dynamic;
  var AppifactValue: Dynamic;
  var PlatformFileContentBeforeWriteVersionOfState: Dynamic;
  var PlatformFileContentController: Dynamic;
  var PlatformFileContentCache_2: Dynamic;
  var PlatformFileContentWebpAvifPattern_2: Dynamic;
  var projectFilesystem: Dynamic;
  var PreviewGenerationGate: Dynamic;
  var defaultPreviewGenerationGate: Dynamic;
  var PlatformFileContentElementCache: Dynamic;
  var PlatformFileContentAlias_2: Dynamic;
  var requestRoomCapabilityValue: Dynamic;
  var PlatformFileContentFreezeValue: Dynamic;
  var PlatformFileContentFreezeValueAlias: Dynamic;
  var PlatformFileContentSubscribers_4: Dynamic;
  var roomPeerSubscriptionStarted: Dynamic;
  var PlatformFileContentCurrentState: Dynamic;
  var roomPeersStore: Dynamic;
  var PlatformFileContentAZaZPattern_3: Dynamic;
  var PlatformFileContentAZaZPattern_4: Dynamic;
  var PlatformFileContentResolvedValue_12: Dynamic;
  var PlatformFileContentSubscribers_5: Dynamic;
  var embeddedWritesTracked: Dynamic;
  var embeddedEditorFrozen: Dynamic;
  var embeddedFreezeRequested: Dynamic;
  var embeddedWriteFailed: Dynamic;
  var PlatformFileContentAlias_3: Dynamic;
  var PlatformFileContentAlias_4: Dynamic;
  var PlatformFileContentCurrentState_2: Dynamic;
  var PlatformFileContentDelayMs: Dynamic;
  var PlatformFileContentConstant_22: Dynamic;
  var PlatformFileContentConstant_23: Dynamic;
  function isNarrowedFileContext(input?: Dynamic, options?: Dynamic): Dynamic {
    return input.narrowed ?? options.narrowed === true;
  }
  function validateFileName(input?: Dynamic): Dynamic {
    if (
      input === "" ||
      (0, runtime.PlatformSha256Encode)(input).length >
        PlatformFileContentLimit_2
    )
      return "its name is empty or too long. Rename it";
    if (/[\u0000-\u001f\u007f%;:\\]/.test(input))
      return "its name has a character that cannot be saved (% ; : \\ or a control character). Rename it";
    if (input.endsWith(".cmekshadow"))
      return "its name ends in .cmekshadow, which is reserved. Rename it";
    let value: Dynamic = input.split("/");
    if (
      input.startsWith("/") ||
      value.some(
        (input2?: Dynamic): Dynamic =>
          input2 === "" || input2 === "." || input2 === "..",
      )
    )
      return "its path has an empty part, or a part that is only dots. Rename it";
    if (value[0].startsWith("_"))
      return "its top-level name starts with an underscore, which is reserved. Rename it";
  }
  function isTextFileContent(input?: Dynamic, options?: Dynamic): Dynamic {
    if (options === null) return false;
    let value: Dynamic = normalizeFileEntry(input, options);
    return (
      value !== null &&
      typeof value != "string" &&
      typeof value.content == "string" &&
      PlatformFileContentSubscribers_3.has(value.contentType) &&
      PlatformFileContentIncludes(value.content)
    );
  }
  function describeInvalidFile(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = validateFileName(input);
    if (value !== undefined)
      return {
        why: value,
        cause: "name",
      };
    if (options === null) return;
    let value2: Dynamic = normalizeFileEntry(input, options);
    return typeof value2 == "string"
      ? value2.includes("files of this kind")
        ? {
            why: value2.slice(value2.indexOf(": ") + 2),
            cause: "kind",
          }
        : value2.includes("cannot infer a content type")
          ? {
              why: "files of this kind cannot be saved here (nothing is known for a name like this). Use another format",
              cause: "kind",
            }
          : {
              why: "it is in a form that cannot be saved here",
              cause: "unreadable",
            }
      : isTextFileContent(input, options)
        ? {
            why:
              "it holds a character that did not decode (it shows as " +
              Value_2 +
              "). Find it and type it again",
            cause: "damaged_text",
          }
        : undefined;
  }
  function getMimeTypeForPath(input?: Dynamic): Dynamic {
    let value: Dynamic = input.lastIndexOf("/"),
      value2: Dynamic = input.lastIndexOf(".");
    if (!(value2 <= value + 1))
      return PlatformFileContentCache.get(
        input.slice(value2 + 1).toLowerCase(),
      );
  }
  function stripFrameRuntime(input?: Dynamic): Dynamic {
    let value: Dynamic = input.indexOf(frameRuntimeStartMarker);
    if (value < 0) return input;
    let value2: Dynamic = input.indexOf(
      frameRuntimeEndMarker,
      value + frameRuntimeStartMarker.length,
    );
    return value2 < 0
      ? input
      : input.slice(0, value) +
          input.slice(value2 + frameRuntimeEndMarker.length);
  }
  function normalizeFileEntry(input?: Dynamic, options?: Dynamic): Dynamic {
    if (options === null) return null;
    let value: Dynamic = options,
      value2: Dynamic;
    typeof options == "object" &&
      !(typeof Blob !== "undefined" && options instanceof Blob) &&
      ((value = options.content), (value2 = options.contentType));
    let value3: Dynamic = typeof Blob !== "undefined" && value instanceof Blob;
    if (typeof value != "string" && !value3)
      return input + ": content must be a string or a Blob";
    let value4: Dynamic = value3 ? value.type.split(";")[0].trim() : "",
      value5: Dynamic =
        value2 ??
        (PlatformFileContentSubscribers.has(value4) ? value4 : undefined) ??
        getMimeTypeForPath(input) ??
        (value4 !== "" ? value4 : undefined);
    return value5 === undefined
      ? input +
          ": cannot infer a content type from the name; pass {content, contentType}"
      : value5 === "" || value5.includes(";")
        ? input + ": contentType must be a bare media type"
        : !PlatformFileContentSubscribers.has(value5) &&
            !(
              value2 !== undefined &&
              PlatformFileContentSubscribers_2.has(value5)
            )
          ? input +
            ": files of this kind (" +
            value5 +
            ") cannot be saved here. Use another format"
          : {
              content: value,
              contentType: value5,
            };
  }
  function getEncodedFileBytes(input?: Dynamic): Dynamic {
    if (input === null) return 0;
    let value: Dynamic = getFileContent(input);
    return typeof value == "string"
      ? (0, runtime.PlatformSha256Encode)(value).length
      : Math.ceil(value.size / 3) * 4;
  }
  function getRawFileBytes(input?: Dynamic): Dynamic {
    if (input === null) return 0;
    let value: Dynamic = getFileContent(input);
    return typeof value == "string"
      ? (0, runtime.PlatformSha256Encode)(value).length
      : value.size;
  }
  function describeOversizedFile(input?: Dynamic): Dynamic {
    if (
      input === null ||
      getEncodedFileBytes(input) <= PlatformFileContentResolvedValue
    )
      return;
    let value: Dynamic = typeof getFileContent(input) == "string",
      value2: Dynamic =
        (value
          ? PlatformFileContentResolvedValue
          : (PlatformFileContentResolvedValue / 4) * 3) /
        (1024 * 1024);
    return (
      "it is over the " +
      String(value2) +
      " MB limit for one file. Make it smaller" +
      (value ? " (an image or a font pasted into it is the usual cause)" : "")
    );
  }
  async function fileContentToBytes(input?: Dynamic): Promise<Dynamic> {
    return typeof input == "string"
      ? (0, runtime.PlatformSha256Encode)(input)
      : new Uint8Array(await input.arrayBuffer());
  }
  async function hashFileMap(input?: Dynamic): Promise<Dynamic> {
    let state: Dynamic = {};
    for (let [value, value2] of Object.entries(input) as Dynamic) {
      let value3: Dynamic = normalizeFileEntry(value, value2);
      value3 === null ||
        typeof value3 == "string" ||
        (state[value] = await (0, runtime.sha256)(
          await fileContentToBytes(value3.content),
        ));
    }
    return state;
  }
  function validatePublishFileMap(input?: Dynamic): Dynamic {
    let value: Dynamic = Object.keys(input);
    if (value.length === 0 || value.length > PlatformFileContentLimit)
      return {
        ok: false,
        code: "invalid_content",
      };
    let index: Dynamic = 0;
    for (let value2 of value as Dynamic) {
      if (validateFileName(value2) !== undefined)
        return {
          ok: false,
          code: "invalid_content",
        };
      if (typeof normalizeFileEntry(value2, input[value2]) == "string")
        return {
          ok: false,
          code: "invalid_content",
        };
      index += getEncodedFileBytes(input[value2]);
    }
    return index > PlatformFileContentResolvedValue
      ? {
          ok: false,
          code: "too_large",
        }
      : undefined;
  }
  function splitPublishBatches(
    input?: Dynamic,
    options: Dynamic = runtime.isProjectMetadataFile,
    context: Dynamic = PlatformFileContentResolvedValue_2,
    value: Dynamic = PlatformFileContentLimit,
  ): Dynamic {
    let value2: Dynamic = Object.entries(input),
      value3: Dynamic = value2.filter(
        ([input2]: Dynamic): Dynamic => !options(input2),
      ),
      value4: Dynamic = value2.filter(
        ([input2]: Dynamic): Dynamic => options(input2),
      ),
      items: Dynamic = [],
      state: Dynamic = {},
      index: Dynamic = 0,
      index2: Dynamic = 0,
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value5: Dynamic = getEncodedFileBytes(options2);
        index2 > 0 &&
          (index + value5 > context || index2 + 1 > value) &&
          (items.push(state), (state = {}), (index = 0), (index2 = 0));
        state[input2] = options2;
        index += value5;
        index2 += 1;
      };
    for (let [value5, value6] of value3 as Dynamic) callback(value5, value6);
    for (let [value5, value6] of value4 as Dynamic) callback(value5, value6);
    index2 > 0 && items.push(state);
    return items;
  }
  function hasInjectedRuntime(input?: Dynamic): Dynamic {
    if (input === null) return false;
    let value: Dynamic =
      typeof input == "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? input.content
        : input;
    return (
      typeof value == "string" &&
      (value.includes("/_cas/") ||
        value.includes(frameRuntimeStartMarker) ||
        value.includes("__frame_comments__"))
    );
  }
  function artboardAppearanceProperties(input?: Dynamic): Dynamic {
    let state: Dynamic = {};
    if (input)
      for (let value of PlatformFileContentExpandPrintPaperValues as Dynamic)
        input[value] !== undefined && (state[value] = input[value]);
    return state;
  }
  function resolveArtboardGuide(source?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = source.color ?? PlatformFileContentLabel;
    if (source.kind === "grid")
      return {
        kind: "grid",
        size: source.size ?? 8,
        color: value,
      };
    let value2: Dynamic = source.kind === "columns",
      value3: Dynamic = source.align ?? (value2 ? "stretch" : "start"),
      value4: Dynamic = source.size ?? (value2 ? 64 : 8),
      value5: Dynamic = source.gutter ?? (value2 ? 24 : 8),
      value6: Dynamic = source.offset ?? 0,
      value7: Dynamic = source.count ?? (value2 ? 12 : "auto"),
      value8: Dynamic =
        (value2 ? options.w : options.h) - (value3 === "center" ? 0 : value6),
      value9: Dynamic =
        value7 !== "auto"
          ? value7
          : value3 === "stretch"
            ? value2
              ? 12
              : 4
            : PlatformFileContentMin_2(
                Math.floor((value8 + value5) / (value4 + value5)),
                1,
                PlatformFileContentConstant,
              );
    return {
      kind: source.kind,
      count: value9,
      align: value3,
      size: value4,
      gutter: value5,
      margin: source.margin ?? 0,
      offset: value6,
      color: value,
      auto: value7 === "auto",
    };
  }
  function normalizeArtboardRadius(items?: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      typeof input == "number" && Number.isFinite(input)
        ? PlatformFileContentMin_2(
            Math.round(input * 100) / 100,
            0,
            PlatformFileContentResolvedValue_3,
          )
        : null;
    if (Array.isArray(items) && items.length !== 4) return;
    let value: Dynamic = Array.isArray(items)
      ? Array.from(items, callback)
      : Array(4).fill(callback(items));
    if (value.some((input?: Dynamic): Dynamic => input === null)) return;
    let [value2, value3, value4, value5]: Dynamic = value;
    return value2 === value3 && value3 === value4 && value4 === value5
      ? value2 > 0
        ? value2
        : undefined
      : [value2, value3, value4, value5];
  }
  function artboardRadiusCorners(input?: Dynamic): Dynamic {
    return typeof input == "number"
      ? [input, input, input, input]
      : input
        ? [...input]
        : [0, 0, 0, 0];
  }
  function artboardRadiusCss(input?: Dynamic): Dynamic {
    let value: Dynamic = normalizeArtboardRadius(input);
    return value === undefined
      ? undefined
      : (typeof value == "number" ? [value] : value)
          .map((input2?: Dynamic): Dynamic => String(input2) + "px")
          .join(" ");
  }
  function updateArtboardRadius(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return {
      ...input,
      artboards: input.artboards.map((input2?: Dynamic): Dynamic => {
        if (input2.file !== options) return input2;
        let { radius: value, ...value2 }: Dynamic = input2;
        return context !== undefined
          ? {
              ...value2,
              radius: context,
            }
          : value2;
      }),
    };
  }
  function parseArtboardGuides(input?: Dynamic): Dynamic {
    if (!Array.isArray(input)) return;
    let callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        typeof input2 == "number" && Number.isFinite(input2)
          ? PlatformFileContentMin_2(
              Math.round(input2 * 100) / 100,
              options.min,
              options.max,
            )
          : undefined,
      items: Dynamic = [];
    for (let value of input as Dynamic) {
      if (items.length >= 6) break;
      if (typeof value != "object" || value === null) continue;
      let value2: Dynamic = value,
        value3: Dynamic =
          typeof value2.color == "string" &&
          PlatformFileContentPattern.test(value2.color.trim())
            ? value2.color.trim()
            : undefined,
        state: Dynamic = {
          ...(value3 !== undefined
            ? {
                color: value3,
              }
            : {}),
          ...(value2.hidden === true
            ? {
                hidden: true,
              }
            : {}),
        };
      if (value2.kind === "grid") {
        let value4: Dynamic = callback(
          value2.size,
          PlatformFileContentGridSizeCountSizeConfig.gridSize,
        );
        items.push({
          kind: "grid",
          ...(value4 !== undefined
            ? {
                size: value4,
              }
            : {}),
          ...state,
        });
      } else if (value2.kind === "columns" || value2.kind === "rows") {
        let value4: Dynamic =
            value2.align === "stretch" ||
            value2.align === "start" ||
            value2.align === "center" ||
            value2.align === "end"
              ? value2.align
              : undefined,
          value5: Dynamic =
            value2.count === "auto"
              ? "auto"
              : typeof value2.count == "number" && Number.isFinite(value2.count)
                ? PlatformFileContentMin_2(
                    Math.round(value2.count),
                    PlatformFileContentGridSizeCountSizeConfig.count.min,
                    PlatformFileContentGridSizeCountSizeConfig.count.max,
                  )
                : undefined,
          value6: Dynamic = callback(
            value2.size,
            PlatformFileContentGridSizeCountSizeConfig.size,
          ),
          value7: Dynamic = callback(
            value2.gutter,
            PlatformFileContentGridSizeCountSizeConfig.gutter,
          ),
          value8: Dynamic = callback(
            value2.margin,
            PlatformFileContentGridSizeCountSizeConfig.margin,
          ),
          value9: Dynamic = callback(
            value2.offset,
            PlatformFileContentGridSizeCountSizeConfig.offset,
          );
        items.push({
          kind: value2.kind,
          ...(value5 !== undefined
            ? {
                count: value5,
              }
            : {}),
          ...(value4 !== undefined
            ? {
                align: value4,
              }
            : {}),
          ...(value6 !== undefined
            ? {
                size: value6,
              }
            : {}),
          ...(value7 !== undefined
            ? {
                gutter: value7,
              }
            : {}),
          ...(value8 !== undefined
            ? {
                margin: value8,
              }
            : {}),
          ...(value9 !== undefined
            ? {
                offset: value9,
              }
            : {}),
          ...state,
        });
      }
    }
    return items.length > 0 ? items : undefined;
  }
  function maxDesignPages(): Dynamic {
    return PlatformFileContentLimitAlias;
  }
  function parseAnnotationCrop(input?: Dynamic): Dynamic {
    if (input === null || typeof input != "object") return;
    let value: Dynamic = input,
      callback: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value2?: Dynamic,
      ): Dynamic =>
        typeof value[input2] == "number" && Number.isFinite(value[input2])
          ? Math.round(
              Math.min(context, Math.max(options, value[input2])) *
                10 ** value2,
            ) /
            10 ** value2
          : null,
      [items, items2, items3]: Dynamic = [
        callback("zoom", 1, 50, 4),
        callback("x", 0, 1, 5),
        callback("y", 0, 1, 5),
      ];
    return items === null ||
      items2 === null ||
      items3 === null ||
      (items === 1 && items2 === 0.5 && items3 === 0.5)
      ? undefined
      : {
          zoom: items,
          x: items2,
          y: items3,
        };
  }
  function updateAnnotationCrop(input?: Dynamic, options?: Dynamic): Dynamic {
    let { crop: value, ...value2 }: Dynamic = input;
    return options === undefined
      ? value2
      : {
          ...value2,
          crop: options,
        };
  }
  function updateAnnotationAlt(input?: Dynamic, options?: Dynamic): Dynamic {
    let { alt: value, ...value2 }: Dynamic = input;
    return options === undefined
      ? value2
      : {
          ...value2,
          alt: options,
        };
  }
  function updateAnnotationVideo(input?: Dynamic, options?: Dynamic): Dynamic {
    let { video: value, ...value2 }: Dynamic = input;
    return options === undefined
      ? value2
      : {
          ...value2,
          video: options,
        };
  }
  function updateAnnotationArrowHeads(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let { headStart: value, headEnd: value2, ...value3 }: Dynamic = input;
    return {
      ...value3,
      kind: options.end === "none" ? "line" : "arrow",
      ...(options.start !== "none"
        ? {
            headStart: options.start,
          }
        : {}),
      ...(options.end === "open"
        ? {
            headEnd: "open",
          }
        : {}),
    };
  }
  function updateAnnotationCss(input?: Dynamic, options?: Dynamic): Dynamic {
    let { css: value, ...value2 }: Dynamic = input;
    return options === undefined
      ? value2
      : {
          ...value2,
          css: options,
        };
  }
  function annotationBounds(source?: Dynamic): Dynamic {
    switch (source.kind) {
      case "rect":
      case "oval":
      case "pen":
      case "image":
        return {
          x: source.x,
          y: source.y,
          w: source.w,
          h: source.h,
        };
      case "line":
      case "arrow":
        return {
          x: Math.min(source.x, source.x2),
          y: Math.min(source.y, source.y2),
          w: Math.abs(source.x2 - source.x),
          h: Math.abs(source.y2 - source.y),
        };
    }
  }
  function annotationVisibleBounds(input?: Dynamic): Dynamic {
    if (isShapeAnnotation(input)) return annotationBounds(input);
    let size: Dynamic = annotationTextStyle(input).size;
    return {
      x: input.x,
      y: input.y,
      w: input.w,
      h: Math.min(Math.round(size * 1.45) + 20, PlatformFileContentKind(input)),
    };
  }
  function updateShapeColor(input?: Dynamic, options?: Dynamic): Dynamic {
    let { color: value, ...value2 }: Dynamic = input,
      {
        background: value3,
        "background-color": value4,
        stroke: value5,
        ...value6
      }: Dynamic = value2.css ?? {},
      value7: Dynamic = updateAnnotationCss(
        value2,
        value2.css === undefined
          ? undefined
          : Object.keys(value6).length > 0
            ? value6
            : undefined,
      );
    return options === "default"
      ? value7
      : {
          ...value7,
          color: options,
        };
  }
  function updateAnnotationColor(input?: Dynamic, options?: Dynamic): Dynamic {
    let { color: value, ...value2 }: Dynamic = input;
    return options === "default"
      ? value2
      : {
          ...value2,
          color: options,
        };
  }
  function moveAnnotation(
    source?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return source.kind === "line" || source.kind === "arrow"
      ? {
          ...source,
          x: options,
          y: context,
          x2: source.x2 + options - source.x,
          y2: source.y2 + context - source.y,
        }
      : {
          ...source,
          x: options,
          y: context,
        };
  }
  function annotationGeometry(source?: Dynamic): Dynamic {
    switch (source.kind) {
      case "rect":
      case "oval":
      case "pen":
      case "image":
        return {
          x: source.x,
          y: source.y,
          w: source.w,
          h: source.h,
          rotate: source.rotate ?? 0,
        };
      case "line":
      case "arrow":
        return {
          x: source.x,
          y: source.y,
          x2: source.x2,
          y2: source.y2,
        };
    }
  }
  function normalizeRotationDegrees(degrees?: Dynamic): Dynamic {
    if (typeof degrees != "number" || !Number.isFinite(degrees)) return 0;
    let normalized: Dynamic = ((Math.round(degrees) % 360) + 360) % 360;
    return normalized > 180 ? normalized - 360 : normalized;
  }
  function rotatedAnnotationBounds(
    annotation?: Dynamic,
    rect?: Dynamic,
  ): Dynamic {
    let degrees: Dynamic = annotationRotation(annotation);
    if (!degrees) return rect;
    let value: Dynamic = (degrees * Math.PI) / 180,
      [items, items2]: Dynamic = [
        Math.abs(Math.cos(value)),
        Math.abs(Math.sin(value)),
      ],
      [items3, items4]: Dynamic = [
        rect.w * items + rect.h * items2,
        rect.w * items2 + rect.h * items,
      ];
    return {
      x: rect.x + (rect.w - items3) / 2,
      y: rect.y + (rect.h - items4) / 2,
      w: items3,
      h: items4,
    };
  }
  function updateAnnotationTextStyle(
    input?: Dynamic,
    source?: Dynamic,
  ): Dynamic {
    let value: Dynamic = annotationTextStyle(input),
      value2: Dynamic =
        source.kind !== undefined && source.kind !== value.kind
          ? PlatformFileContentNoteTitle1Config[source.kind]
          : value,
      state: Dynamic = {
        size: PlatformFileContentHandler_2(
          Number.isFinite(source.size) ? source.size : value2.size,
          value2.size,
        ),
        kind: source.kind ?? value.kind,
        bold: source.bold ?? value2.bold,
        italic: source.italic ?? value2.italic,
        color: source.color ?? value2.color,
        fill: source.fill ?? value2.fill,
      },
      {
        id: value3,
        x: value4,
        y: value5,
        w: value6,
        text: value7,
        page: value8,
        rotate: value9,
      }: Dynamic = input;
    return {
      id: value3,
      x: value4,
      y: value5,
      w: value6,
      ...(state.kind === value.kind
        ? PlatformFileContentHandler(state.kind, input.maxW, input.maxH)
        : {}),
      text: value7,
      ...PlatformFileContentKind_2(state),
      ...(value8 !== undefined
        ? {
            page: value8,
          }
        : {}),
      ...(value9
        ? {
            rotate: value9,
          }
        : {}),
    };
  }
  function designPageId(item?: Dynamic, pages?: Dynamic): Dynamic {
    let defaultPage: Dynamic = pages?.[0]?.id ?? "";
    return item.page === undefined
      ? defaultPage
      : pages?.some((input?: Dynamic): Dynamic => input.id === item.page)
        ? item.page
        : defaultPage;
  }
  function findArtboardByName(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.find(
      (input2?: Dynamic): Dynamic => input2.file === options,
    );
    if (value) return value;
    let value2: Dynamic = artboardNameWithoutExtension(options),
      value3: Dynamic = input.filter(
        (input2?: Dynamic): Dynamic =>
          artboardNameWithoutExtension(input2.file) === value2,
      ),
      value4: Dynamic =
        value3.length > 1 && context ? value3.filter(context) : value3;
    return value4.length === 1
      ? value4[0]
      : value3.length > 0
        ? "ambiguous"
        : null;
  }
  function createPageId(pages?: Dynamic, randomize: Dynamic = false): Dynamic {
    let values: Dynamic = new Set(
      pages.map((input?: Dynamic): Dynamic => input.id),
    );
    if (randomize)
      for (;;) {
        let value: Dynamic = "page-" + Math.random().toString(36).slice(2, 8);
        if (!values.has(value)) return value;
      }
    let count: Dynamic = 1;
    for (; values.has("page-" + String(count)); ) count += 1;
    return "page-" + String(count);
  }
  function annotationTextFit(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (input.w <= 0 || input.h <= 0)
      return {
        k: 1,
        wrap: false,
      };
    let value2: Dynamic = Math.min(1, context / input.w, value / input.h),
      value3: Dynamic =
        Math.min(PlatformFileContentConstant_14, options) / options;
    return value2 >= value3
      ? {
          k: value2,
          wrap: false,
        }
      : {
          k: value3,
          wrap: true,
        };
  }
  function annotationLineEndpoints(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.w > 0 || options.h > 0,
      [value2, value3]: Dynamic = value
        ? [options.w, options.h]
        : PlatformFileContentRectOvalLineConfig[input],
      [value4, value5]: Dynamic = value ? [context.x, context.y] : [1, 1],
      [value6, value7]: Dynamic =
        value4 === 1
          ? [options.x, options.x + value2]
          : [options.x + value2, options.x],
      [value8, value9]: Dynamic =
        value5 === 1
          ? [options.y, options.y + value3]
          : [options.y + value3, options.y];
    return {
      x: value6,
      y: value8,
      x2: value7,
      y2: value9,
    };
  }
  function isArtboardFile(path?: Dynamic): Dynamic {
    return path.endsWith(".dc.html");
  }
  function isDesignSystemFile(path?: Dynamic): Dynamic {
    return path.startsWith("ds/");
  }
  function parseShapeAnnotation(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        typeof input2 == "number" && Number.isFinite(input2)
          ? input2
          : options2,
      value: Dynamic = PlatformFileContentMin_2(
        callback(input.x, 0),
        -PlatformFileContentConstant_18,
        PlatformFileContentConstant_18,
      ),
      value2: Dynamic = PlatformFileContentMin_2(
        callback(input.y, 0),
        -PlatformFileContentConstant_18,
        PlatformFileContentConstant_18,
      ),
      value3: Dynamic = PlatformFileContentIncludes_2(input.color),
      value4: Dynamic = normalizeAnnotationCss(input.css),
      value5: Dynamic = normalizeRotationDegrees(input.rotate),
      value6: Dynamic =
        context === "rect" || context === "oval" || context === "image",
      state: Dynamic = {
        ...(value5 !== 0 && context !== "line" && context !== "arrow"
          ? {
              rotate: value5,
            }
          : {}),
        ...(input.flipX === true && value6
          ? {
              flipX: true,
            }
          : {}),
        ...(input.flipY === true && value6
          ? {
              flipY: true,
            }
          : {}),
      },
      state2: Dynamic = {
        ...(value3 !== "default"
          ? {
              color: value3,
            }
          : {}),
        ...(value4 !== undefined
          ? {
              css: value4,
            }
          : {}),
        ...(PlatformFileContentTest_4(input.page) !== null
          ? {
              page: PlatformFileContentTest_4(input.page),
            }
          : {}),
        ...state,
      },
      [value7, value8]: Dynamic =
        PlatformFileContentRectOvalLineConfig[context];
    if (context === "pen") {
      let value9: Dynamic = PlatformFileContentTrim_2(input.d);
      return value9 === null
        ? null
        : {
            id: options,
            kind: context,
            x: value,
            y: value2,
            w: PlatformFileContentMin_2(
              callback(input.w, value7),
              PlatformFileContentConstant_19,
              PlatformFileContentLimit_6,
            ),
            h: PlatformFileContentMin_2(
              callback(input.h, value8),
              PlatformFileContentConstant_19,
              PlatformFileContentLimit_6,
            ),
            d: value9,
            ...state2,
          };
    }
    if (context === "image") {
      let value9: Dynamic = PlatformFileContentTest_2(input.src);
      if (value9 === null) return null;
      let value10: Dynamic = PlatformFileContentSlice(input.alt),
        value11: Dynamic = PlatformFileContentTest_4(input.page),
        value12: Dynamic = value4?.["object-fit"],
        value13: Dynamic =
          value12 === undefined || value12 === "cover"
            ? parseAnnotationCrop(input.crop)
            : undefined,
        value14: Dynamic = PlatformFileContentTest_3(input.video);
      return {
        id: options,
        kind: context,
        x: value,
        y: value2,
        w: PlatformFileContentMin_2(
          callback(input.w, value7),
          PlatformFileContentConstant_20,
          PlatformFileContentLimit_6,
        ),
        h: PlatformFileContentMin_2(
          callback(input.h, value8),
          PlatformFileContentConstant_20,
          PlatformFileContentLimit_6,
        ),
        src: value9,
        ...(value14 !== null
          ? {
              video: value14,
            }
          : {}),
        ...(value10 !== undefined
          ? {
              alt: value10,
            }
          : {}),
        ...(value4 !== undefined
          ? {
              css: value4,
            }
          : {}),
        ...(value13 !== undefined
          ? {
              crop: value13,
            }
          : {}),
        ...(value11 !== null
          ? {
              page: value11,
            }
          : {}),
        ...state,
      };
    }
    if (context === "line" || context === "arrow") {
      let callback2: Dynamic = (input2?: Dynamic): Dynamic =>
          input2 === "none" || input2 === "open" || input2 === "filled"
            ? input2
            : null,
        state3: Dynamic = {
          id: options,
          kind: context,
          x: value,
          y: value2,
          x2: PlatformFileContentMin_2(
            callback(input.x2, value + value7),
            -PlatformFileContentConstant_18,
            PlatformFileContentConstant_18,
          ),
          y2: PlatformFileContentMin_2(
            callback(input.y2, value2 + value8),
            -PlatformFileContentConstant_18,
            PlatformFileContentConstant_18,
          ),
          ...state2,
        };
      return updateAnnotationArrowHeads(state3, {
        start: callback2(input.headStart) ?? "none",
        end:
          callback2(input.headEnd) ?? (context === "arrow" ? "filled" : "none"),
      });
    }
    return {
      id: options,
      kind: context,
      x: value,
      y: value2,
      w: PlatformFileContentMin_2(
        callback(input.w, value7),
        PlatformFileContentConstant_19,
        PlatformFileContentLimit_6,
      ),
      h: PlatformFileContentMin_2(
        callback(input.h, value8),
        PlatformFileContentConstant_19,
        PlatformFileContentLimit_6,
      ),
      ...state2,
    };
  }
  function parseAnnotation(rawAnnotation?: Dynamic): Dynamic {
    if (rawAnnotation === null || typeof rawAnnotation != "object") return null;
    let annotation: Dynamic = rawAnnotation,
      id: Dynamic = PlatformFileContentTest_4(annotation.id);
    if (id === null) return null;
    let kind: Dynamic =
      typeof annotation.text == "string" && annotation.text !== ""
        ? null
        : PlatformFileContentHandler_3(annotation.kind);
    if (kind !== null) return parseShapeAnnotation(annotation, id, kind);
    let callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        typeof input == "number" && Number.isFinite(input) ? input : options,
      value: Dynamic =
        annotation.kind === "text" &&
        PlatformFileContentHandler_2(
          annotation.size,
          PlatformFileContentConstant_2,
        ) >= PlatformFileContentSMLConfig.l,
      value2: Dynamic =
        PlatformFileContentNoteTitle1Config[
          PlatformFileContentTest(annotation.kind) || value ? "title1" : "note"
        ],
      value3: Dynamic = PlatformFileContentSlice_2(annotation.text),
      value4: Dynamic = PlatformFileContentHandler_2(
        annotation.size,
        value2.size,
      ),
      value5: Dynamic = normalizeRotationDegrees(annotation.rotate);
    return {
      id: id,
      x: PlatformFileContentMin_2(
        callback(annotation.x, 0),
        -PlatformFileContentConstant_18,
        PlatformFileContentConstant_18,
      ),
      y: PlatformFileContentMin_2(
        callback(annotation.y, 0),
        -PlatformFileContentConstant_18,
        PlatformFileContentConstant_18,
      ),
      w: PlatformFileContentMin_2(
        typeof annotation.w == "number" && Number.isFinite(annotation.w)
          ? annotation.w
          : value2.kind === "note"
            ? PlatformFileContentL(value3, value4)
            : PlatformFileContentConstant_8,
        PlatformFileContentConstant_9,
        PlatformFileContentConstant_10,
      ),
      ...PlatformFileContentHandler(
        value2.kind,
        annotation.maxW,
        annotation.maxH,
      ),
      text: value3,
      ...PlatformFileContentKind_2(
        value
          ? value2
          : {
              size: value4,
              kind: value2.kind,
              bold:
                typeof annotation.bold == "boolean"
                  ? annotation.bold
                  : value2.bold,
              italic:
                typeof annotation.italic == "boolean"
                  ? annotation.italic
                  : value2.italic,
              color: PlatformFileContentIncludes_2(annotation.color),
              fill: PlatformFileContentIncludes_3(annotation.fill),
            },
      ),
      ...(PlatformFileContentTest_4(annotation.page) !== null
        ? {
            page: PlatformFileContentTest_4(annotation.page),
          }
        : {}),
      ...(value5 !== 0
        ? {
            rotate: value5,
          }
        : {}),
    };
  }
  function parseDesignPages(input?: Dynamic): Dynamic {
    if (!Array.isArray(input)) return [];
    let items: Dynamic = [],
      values: Dynamic = new Set();
    for (let value of input as Dynamic) {
      if (items.length >= maxDesignPages()) break;
      if (value === null || typeof value != "object") continue;
      let value2: Dynamic = value,
        value3: Dynamic = PlatformFileContentTest_4(value2.id);
      value3 === null ||
        values.has(value3) ||
        (values.add(value3),
        items.push({
          id: value3,
          name:
            PlatformFileContentSlice(value2.name) ??
            "Page " + String(items.length + 1),
        }));
    }
    return items;
  }
  function parseArtboardSpec(spec?: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        typeof input == "number" && Number.isFinite(input) ? input : options,
      value: Dynamic = PlatformFileContentSlice(spec.title),
      expand: Dynamic = spec.expand,
      print: Dynamic = spec.print,
      paper: Dynamic = spec.paper,
      value2: Dynamic = PlatformFileContentTest_4(spec.page),
      value3: Dynamic = spec.is_interactive === true,
      value4: Dynamic = spec.frameless === true,
      value5: Dynamic = parseArtboardGuides(spec.guides),
      value6: Dynamic = normalizeArtboardRadius(spec.radius);
    return {
      file: spec.file,
      x: PlatformFileContentMin_2(
        callback(spec.x, 0),
        -PlatformFileContentConstant_18,
        PlatformFileContentConstant_18,
      ),
      y: PlatformFileContentMin_2(
        callback(spec.y, 0),
        -PlatformFileContentConstant_18,
        PlatformFileContentConstant_18,
      ),
      w: PlatformFileContentMin_2(
        callback(spec.w, PlatformFileContentConstant_5),
        value4
          ? PlatformFileContentConstant_17
          : PlatformFileContentConstant_15,
        PlatformFileContentLimit_6,
      ),
      h: PlatformFileContentMin_2(
        callback(spec.h, PlatformFileContentConstant_6),
        value4
          ? PlatformFileContentConstant_17
          : PlatformFileContentConstant_15,
        PlatformFileContentLimit_6,
      ),
      ...(value !== undefined
        ? {
            title: value,
          }
        : {}),
      ...(expand === "fill"
        ? {
            expand: "fill",
          }
        : {}),
      ...(print === "flow"
        ? {
            print: "flow",
          }
        : {}),
      ...(paper === "letter" || paper === "a4"
        ? {
            paper: paper,
          }
        : {}),
      ...(value2 !== null
        ? {
            page: value2,
          }
        : {}),
      ...(value3
        ? {
            is_interactive: true,
          }
        : {}),
      ...(value4
        ? {
            frameless: true,
          }
        : {}),
      ...(value5 !== undefined
        ? {
            guides: value5,
          }
        : {}),
      ...(value6 !== undefined
        ? {
            radius: value6,
          }
        : {}),
    };
  }
  function artboardSpecFromProps(input?: Dynamic): Dynamic {
    let value: Dynamic = parseArtboardSpec({
      ...(typeof input == "object" && input !== null ? input : {}),
      file: "",
    });
    return {
      w: value.w,
      h: value.h,
      ...(value.title !== undefined
        ? {
            title: value.title,
          }
        : {}),
      ...artboardAppearanceProperties(value),
    };
  }
  function readEmbeddedArtboardProps(input?: Dynamic): Dynamic {
    try {
      let value: Dynamic =
        typeof input == "string"
          ? PlatformFileContentScriptDataPropsPattern.exec(input)
          : null;
      if (!value) return null;
      let value2: Dynamic = (value[1] ?? value[2] ?? "")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&"),
        value3: Dynamic = JSON.parse(value2)?.$preview,
        callback: Dynamic = (input2?: Dynamic): Dynamic =>
          typeof input2 == "number" && Number.isFinite(input2) && input2 > 0,
        value4: Dynamic = value3?.width,
        value5: Dynamic = value3?.height;
      return callback(value4) && callback(value5)
        ? {
            w: value4,
            h: value5,
          }
        : null;
    } catch {
      return null;
    }
  }
  function nextArtboardPosition(items?: Dynamic): Dynamic {
    if (items.length === 0)
      return {
        x: 0,
        y: 0,
      };
    let value: Dynamic = Math.max(
        ...items.map((input?: Dynamic): Dynamic => input.x + input.w),
      ),
      value2: Dynamic = Math.min(
        ...items.map((input?: Dynamic): Dynamic => input.y),
      );
    return {
      x: value + PlatformFileContentConstant_7,
      y: value2,
    };
  }
  function parseCanvasMetadata(
    metadataJson?: Dynamic,
    files?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(Object.keys(files).filter(isArtboardFile)),
      items: Dynamic = [],
      values2: Dynamic = new Set(),
      value: Dynamic = null;
    if (metadataJson) {
      try {
        value = JSON.parse(metadataJson);
      } catch {
        value = null;
      }
      let value7: Dynamic = value?.artboards;
      if (Array.isArray(value7))
        for (let value8 of value7 as Dynamic) {
          if (!value8 || typeof value8 != "object") continue;
          let file: Dynamic = value8.file;
          typeof file == "string" &&
            (!values.has(file) ||
              values2.has(file) ||
              (values2.add(file), items.push(parseArtboardSpec(value8))));
        }
    }
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      Math.round(
        PlatformFileContentMin_2(
          input,
          PlatformFileContentConstant_16,
          PlatformFileContentLimit_6,
        ),
      );
    for (let value7 of values as Dynamic) {
      if (values2.has(value7) || isDesignSystemFile(value7)) continue;
      let value8: Dynamic = readEmbeddedArtboardProps(files[value7]);
      items.push(
        parseArtboardSpec({
          file: value7,
          ...nextArtboardPosition(items),
          ...(value8
            ? {
                w: callback(value8.w),
                h: callback(value8.h),
              }
            : {}),
        }),
      );
    }
    let items2: Dynamic = [],
      values3: Dynamic = new Set(),
      value2: Dynamic = value?.annotations;
    if (Array.isArray(value2))
      for (let value7 of value2 as Dynamic) {
        if (items2.length >= PlatformFileContentLimit_5) break;
        let value8: Dynamic = parseAnnotation(value7);
        value8 === null ||
          values3.has(value8.id) ||
          (values3.add(value8.id), items2.push(value8));
      }
    let value3: Dynamic = parseDesignPages(value?.pages),
      value4: Dynamic = normalizeDesignLaunch(value?.launch, items, value3),
      values4: Dynamic = new Set(
        value3.map((input?: Dynamic): Dynamic => input.id),
      ),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        if (input.page !== undefined && !values4.has(input.page)) {
          let { page: value7, ...value8 }: Dynamic = input;
          return value8;
        }
        return input;
      },
      value5: Dynamic = value?.migrated === true,
      value6: Dynamic = validCoverArtboard(value?.cover, items);
    return {
      artboards: items.map(callback2),
      ...(items2.length > 0
        ? {
            annotations: items2.map(callback2),
          }
        : {}),
      ...(value4 !== undefined
        ? {
            launch: value4,
          }
        : {}),
      ...(value3.length > 0
        ? {
            pages: value3,
          }
        : {}),
      ...(value6 !== undefined
        ? {
            cover: value6,
          }
        : {}),
      ...(value5
        ? {
            migrated: value5,
          }
        : {}),
    };
  }
  function serializeCanvasMetadata(metadata?: Dynamic): Dynamic {
    let pages: Dynamic = parseDesignPages(metadata.pages),
      launch: Dynamic = normalizeDesignLaunch(
        metadata.launch,
        metadata.artboards,
        pages,
      ),
      cover: Dynamic = validCoverArtboard(metadata.cover, metadata.artboards),
      annotations: Dynamic = (metadata.annotations ?? [])
        .map((input?: Dynamic): Dynamic => parseAnnotation(input))
        .filter((input?: Dynamic): Dynamic => input !== null)
        .slice(0, PlatformFileContentLimit_5);
    return JSON.stringify(
      {
        artboards: metadata.artboards.map(
          (input?: Dynamic): Dynamic => parseArtboardSpec(input),
        ),
        ...(annotations.length > 0
          ? {
              annotations: annotations,
            }
          : {}),
        ...(launch !== undefined
          ? {
              launch: launch,
            }
          : {}),
        ...(pages.length > 0
          ? {
              pages: pages,
            }
          : {}),
        ...(cover !== undefined
          ? {
              cover: cover,
            }
          : {}),
        ...(metadata.migrated === true
          ? {
              migrated: true,
            }
          : {}),
      },
      null,
      2,
    );
  }
  function artboardStackOrder(input?: Dynamic, options?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(
        options.map(
          (input2?: Dynamic, options2?: Dynamic): Dynamic => [
            input2.file,
            options2,
          ],
        ),
      ),
      value: Dynamic = input.filter(
        (input2?: Dynamic): Dynamic => entries.has(input2),
      ),
      values: Dynamic = new Set(value),
      value2: Dynamic = options
        .map((input2?: Dynamic): Dynamic => input2.file)
        .filter((input2?: Dynamic): Dynamic => !values.has(input2));
    return [...value, ...value2].map(
      (input2?: Dynamic): Dynamic => ({
        spec: options[entries.get(input2)],
        z: entries.get(input2),
      }),
    );
  }
  function reorderArtboardsOnPages(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [...input],
      values: Dynamic = new Set(
        input
          .filter((input2?: Dynamic): Dynamic => options.has(input2.file))
          .map((input2?: Dynamic): Dynamic => designPageId(input2, value)),
      );
    for (let value2 of values as Dynamic) {
      let value3: Dynamic = input.flatMap(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            designPageId(input2, value) === value2 ? [options2] : [],
        ),
        value4: Dynamic = value3.filter(
          (input2?: Dynamic): Dynamic => options.has(input[input2].file),
        ),
        value5: Dynamic = value3.filter(
          (input2?: Dynamic): Dynamic => !options.has(input[input2].file),
        ),
        value6: Dynamic =
          context === "front" ? [...value5, ...value4] : [...value4, ...value5];
      value3.forEach(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          (items[input2] = input[value6[options2]]),
      );
    }
    return items.every(
      (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        input2 === input[options2],
    )
      ? null
      : items;
  }
  function uniqueArtboardFile(
    files?: Dynamic,
    prefix: Dynamic = "Artboard",
    randomize: Dynamic = false,
  ): Dynamic {
    let values: Dynamic = new Set(
      Object.keys(files)
        .filter(isArtboardFile)
        .map((input?: Dynamic): Dynamic => input.replace(/\.dc\.html$/, "")),
    );
    if (randomize)
      for (;;) {
        let value: Dynamic =
          prefix + "-" + Math.random().toString(36).slice(2, 6);
        if (!values.has(value)) return value + ".dc.html";
      }
    if (!values.has(prefix)) return prefix + ".dc.html";
    let count: Dynamic = 2;
    for (; values.has(prefix + String(count)); ) count += 1;
    return prefix + String(count) + ".dc.html";
  }
  function nextArtboardTitle(input?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (let value of input as Dynamic) {
      let value2: Dynamic = /^Artboard(?: ?(\d{1,9}))?$/.exec(
        artboardDisplayName(value),
      );
      value2 && (index = Math.max(index, value2[1] ? Number(value2[1]) : 1));
    }
    return "Artboard " + String(index + 1);
  }
  function uniqueElementArtboardTitle(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (
        input.trim() === ""
          ? "Element"
          : input
              .trim()
              .replace(
                /^./,
                (input2?: Dynamic): Dynamic => input2.toUpperCase(),
              )
      ).slice(0, PlatformFileContentConstant_21 - 10),
      values: Dynamic = new Set(options.map(artboardDisplayName));
    if (!values.has(value)) return value;
    let count: Dynamic = 2;
    for (; values.has(value + " (" + String(count) + ")"); ) count += 1;
    return value + " (" + String(count) + ")";
  }
  function duplicateArtboardTitle(
    title?: Dynamic,
    artboards?: Dynamic,
  ): Dynamic {
    let baseTitle: Dynamic = title
        .replace(/ copy(?: \d{1,9})?$/, "")
        .slice(0, PlatformFileContentConstant_21 - 10),
      titles: Dynamic = new Set(artboards.map(artboardDisplayName));
    if (!titles.has(baseTitle + " copy")) return baseTitle + " copy";
    let suffix: Dynamic = 2;
    for (; titles.has(baseTitle + " copy " + String(suffix)); ) suffix += 1;
    return baseTitle + " copy " + String(suffix);
  }
  function createAnnotationId(
    annotations?: Dynamic,
    randomize: Dynamic = false,
    prefix: Dynamic = "note",
  ): Dynamic {
    let values: Dynamic = new Set(
      annotations.map((input?: Dynamic): Dynamic => input.id),
    );
    if (randomize)
      for (;;) {
        let value: Dynamic =
          prefix + "-" + Math.random().toString(36).slice(2, 8);
        if (!values.has(value)) return value;
      }
    let count: Dynamic = 1;
    for (; values.has(prefix + "-" + String(count)); ) count += 1;
    return prefix + "-" + String(count);
  }
  function blankDcDocument(): Dynamic {
    return [
      "<!doctype html>",
      "<html>",
      '<head><meta charset="utf-8"><script src="./support.js"><\/script></head>',
      "<body>",
      "<x-dc>",
      "  <helmet>",
      "    <style>",
      "      html, body { margin: 0; height: 100%; }",
      "      body { background: #ffffff; }",
      "    </style>",
      "  </helmet>",
      '  <section class="stage" style="width:100%;height:100vh"></section>',
      "</x-dc>",
      "</body>",
      "</html>",
      "",
    ].join(`
`);
  }
  function replaceDesignArtboards(
    metadata?: Dynamic,
    artboards?: Dynamic,
  ): Dynamic {
    return {
      ...metadata,
      artboards: artboards,
    };
  }
  function designArtboardsMatchFiles(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.artboards
        .map((input2?: Dynamic): Dynamic => input2.file)
        .sort(),
      value2: Dynamic = Object.keys(options)
        .filter(
          (input2?: Dynamic): Dynamic =>
            isArtboardFile(input2) &&
            (!isDesignSystemFile(input2) || value.includes(input2)),
        )
        .sort();
    return (
      value2.length === value.length &&
      value2.every(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          input2 === value[options2],
      )
    );
  }
  function designPageContents(metadata?: Dynamic, pageId?: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        designPageId(input, metadata.pages) === pageId,
      value: Dynamic = (metadata.annotations ?? []).filter(callback);
    return {
      ...metadata,
      artboards: metadata.artboards.filter(callback),
      ...(metadata.annotations !== undefined
        ? {
            annotations: value,
          }
        : {}),
    };
  }
  function replaceDesignPageContents(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        designPageId(input2, input.pages) === options,
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.page === undefined && options !== (input.pages?.[0]?.id ?? "")
          ? {
              ...input2,
              page: options,
            }
          : input2,
      items: Dynamic = [
        ...input.artboards.filter(
          (input2?: Dynamic): Dynamic => !callback(input2),
        ),
        ...context.artboards.map(callback2),
      ],
      state: Dynamic = {
        ...input,
        artboards: items,
      };
    if ("annotations" in context) {
      let items2: Dynamic = [
        ...(input.annotations ?? []).filter(
          (input2?: Dynamic): Dynamic => !callback(input2),
        ),
        ...(context.annotations ?? []).map(callback2),
      ];
      items2.length > 0
        ? (state.annotations = items2)
        : delete state.annotations;
    }
    "launch" in context &&
      (context.launch !== undefined
        ? (state.launch = context.launch)
        : delete state.launch);
    return state;
  }
  function isSupportedProjectAsset(input?: Dynamic): Dynamic {
    return (
      PlatformFileContentWebpAvifPattern.test(input) ||
      (PlatformFileContentJsonPattern.test(input) &&
        !PlatformFileContentNodeModulesPattern.test(input))
    );
  }
  function isSafeProjectPath(path?: Dynamic): Dynamic {
    return (
      typeof path == "string" &&
      path.length > 0 &&
      path.length <= PlatformFileContentLimit_8 &&
      !path.includes("..") &&
      path
        .split("/")
        .every(
          (input?: Dynamic): Dynamic =>
            PlatformFileContentAZaZAZaZPattern.test(input) &&
            !PlatformFileContentPattern_3.test(input),
        )
    );
  }
  function isProjectTextFilePath(path?: Dynamic): Dynamic {
    return (
      isSafeProjectPath(path) &&
      PlatformFileContentJsonPattern.test(path) &&
      !PlatformFileContentNodeModulesPattern.test(path)
    );
  }
  function isTypeDeclarationPath(path?: Dynamic): Dynamic {
    return isSafeProjectPath(path) && PlatformFileContentPattern_4.test(path);
  }
  function isFullProjectPath(path?: Dynamic): Dynamic {
    return isSafeProjectPath(path) && path.startsWith(ProjectValue);
  }
  function hashProjectFileKey(input?: Dynamic): Dynamic {
    let value: Dynamic = 0x6c62272e07bb014262b821756295c58dn,
      value2: Dynamic = 0x0000000001000000000000000000013bn,
      value3: Dynamic = (1n << 128n) - 1n;
    for (let value4 of PlatformFileContentTextEncoder.encode(input) as Dynamic)
      value = ((value ^ BigInt(value4)) * value2) & value3;
    return value.toString(16).padStart(32, "0");
  }
  function encodeStorePathSegment(input?: Dynamic): Dynamic {
    let text: Dynamic = "";
    for (let value of PlatformFileContentTextEncoder.encode(input) as Dynamic) {
      let value2: Dynamic = String.fromCharCode(value);
      text +=
        value < 128 && PlatformFileContentAZaZPattern.test(value2)
          ? value2
          : "~" + value.toString(16).padStart(2, "0");
    }
    (text === "." || text === "..") && (text = text.replaceAll(".", "~2e"));
    return text.length > 150 ? "h~" + hashProjectFileKey(input) : text;
  }
  function artboardDocument(spec?: Dynamic, html?: Dynamic): Dynamic {
    let document2: Dynamic = {
      path: spec.file,
    };
    for (let value of PlatformFileContentXYWValues as Dynamic)
      spec[value] !== undefined && (document2[value] = spec[value]);
    document2.html = html;
    return document2;
  }
  function annotationDocument(annotation?: Dynamic): Dynamic {
    let document2: Dynamic = {};
    for (let [value, value2] of Object.entries(annotation) as Dynamic)
      value !== "id" && value2 !== undefined && (document2[value] = value2);
    return document2;
  }
  function projectFileDocument(path?: Dynamic, data?: Dynamic): Dynamic {
    return {
      path: path,
      kind: PlatformFileContentWebpAvifPattern.test(path) ? "image" : "text",
      data: data,
    };
  }
  function canvasMetaDocument(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
      v: 2,
      title: input,
      boardOrder:
        context ??
        options.artboards.map((input2?: Dynamic): Dynamic => input2.file),
    };
    options.pages !== undefined && (state.pages = options.pages);
    options.launch !== undefined && (state.launch = options.launch);
    options.cover !== undefined && (state.cover = options.cover);
    options.migrated === true && (state.migrated = true);
    return state;
  }
  function designSourceDocument(
    url?: Dynamic,
    projectId?: Dynamic,
    exportedAt?: Dynamic,
  ): Dynamic {
    return {
      v: 1,
      app: ClaudeDesignValue,
      url: url,
      projectId: projectId,
      exportedAt: exportedAt,
    };
  }
  function designSourceRefusal(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null || Array.isArray(input))
      return "not an object";
    let value: Dynamic = input;
    if (value.v !== 1) return "v is not 1";
    if (value.app !== ClaudeDesignValue)
      return "app is not " + ClaudeDesignValue;
    if (typeof value.url != "string") return "url is not a string";
    if (value.url.length > PlatformFileContentLimit_9)
      return (
        "url is over " + String(PlatformFileContentLimit_9) + " characters"
      );
    let value2: Dynamic;
    try {
      value2 = new URL(value.url);
    } catch {
      return "url is not an absolute URL";
    }
    if (value2.protocol !== "https:") return "url is not https";
    if (value2.username !== "" || value2.password !== "")
      return "url carries credentials";
    if (value2.href !== value2.origin + value2.pathname)
      return "url carries a query or fragment";
    if (value2.href !== value.url)
      return "url is not in canonical form (" + value2.href + ")";
    if (
      typeof value.projectId != "string" ||
      !PlatformFileContentAZaZPattern_2.test(value.projectId)
    )
      return "projectId is not 1\u201364 of A-Z a-z 0-9 _ -";
    if (value2.pathname !== DesignPValue + value.projectId)
      return "url is not <origin>" + DesignPValue + "<projectId>";
    if (
      typeof value.exportedAt != "string" ||
      !PlatformFileContentPattern_5.test(value.exportedAt) ||
      !Number.isFinite(Date.parse(value.exportedAt))
    )
      return "exportedAt is not an ISO-8601 date-time with a zone";
  }
  function parseDesignSource(input?: Dynamic): Dynamic {
    if (designSourceRefusal(input) !== undefined) return;
    let value: Dynamic = input;
    return designSourceDocument(value.url, value.projectId, value.exportedAt);
  }
  function parseDesignContent(
    input?: Dynamic,
    options: Dynamic = PlatformFileContentResolvedValue_11,
    context: Dynamic = false,
  ): Dynamic {
    let value: Dynamic =
        typeof input == "object" && input !== null ? input : {},
      value2: Dynamic =
        typeof value.files == "object" && value.files !== null
          ? value.files
          : {},
      items: Dynamic = [];
    for (let value3 in value2) {
      if (items.length >= PlatformFileContentFilesValue) break;
      if (
        !Object.hasOwn(value2, value3) ||
        value3.length === 0 ||
        value3.startsWith("/") ||
        value3.includes("\\") ||
        (!context &&
          (value3.length > PlatformFileContentLimit_10 ||
            value3.includes("..")))
      )
        continue;
      let value4: Dynamic = value2[value3];
      typeof value4 == "string" &&
        (PlatformFileContentTextEncoder_2.encode(value4).length > options ||
          items.push([value3, value4]));
    }
    return {
      files: Object.fromEntries(items),
    };
  }
  function getDocumentFileCap(input?: Dynamic): Dynamic {
    return "maxFileBytes" in input && typeof input.maxFileBytes == "number"
      ? input.maxFileBytes
      : "loadState" in input
        ? PlatformFileContentResolvedValue_7
        : PlatformFileContentResolvedValue_11;
  }
  function createDesignDocumentStore(input: Dynamic = {}): Dynamic {
    return (0, runtime.createDocumentStore)({
      parseContent: parseDesignContent,
      initialContent: {
        files: {},
      },
      defaultTitle: "Design",
      ...input,
    });
  }
  function primaryDesignFile(input?: Dynamic): Dynamic {
    let value: Dynamic = Object.keys(input.files).sort();
    return value.includes("Main.dc.html")
      ? "Main.dc.html"
      : (value.find(
          (input2?: Dynamic): Dynamic => input2.endsWith(".dc.html"),
        ) ??
          value[0] ??
          null);
  }
  function fileCapFailureMessage(input?: Dynamic): Dynamic {
    let value: Dynamic = PlatformFileContentOverPerFilePattern.exec(
      input instanceof Error
        ? input.message
        : typeof input == "string"
          ? input
          : "",
    );
    return value
      ? "Not kept: that change would make it larger than " +
          value[1] +
          " MiB (" +
          value[2] +
          ")."
      : undefined;
  }
  function createDocumentKvAdapter(
    input?: Dynamic,
    options: Dynamic = PlatformFileContentResolvedValue_11,
    context: Dynamic = "it would be dropped at the next load",
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      input2.startsWith(FileValue) ? input2.slice(FileValue.length) : null;
    return {
      get(input2: Dynamic): Dynamic {
        let value: Dynamic = callback(input2);
        if (value === null) return Promise.resolve(null);
        let value2: Dynamic = input.content().files[value];
        return Promise.resolve(value2 === undefined ? null : value2);
      },
      set(input2: Dynamic, options2: Dynamic, context2: Dynamic): Dynamic {
        let value: Dynamic = callback(input2);
        if (value === null)
          return Promise.reject(
            new Error("only file/ keys exist in the document seam: " + input2),
          );
        if (PlatformFileContentTextEncoder_3.encode(options2).length > options)
          return Promise.reject(
            new Error(
              "file is over the " +
                String(options / (1024 * 1024)) +
                " MiB per-file cap \u2014 " +
                context,
            ),
          );
        let files: Dynamic = input.content().files;
        return !Object.hasOwn(files, value) &&
          Object.keys(files).length >= PlatformFileContentFilesValue
          ? Promise.reject(
              new Error(
                "file limit reached (" +
                  String(PlatformFileContentFilesValue) +
                  ") \u2014 delete something first",
              ),
            )
          : (input.updateContent(
              (input3?: Dynamic): Dynamic => ({
                files: {
                  ...input3.files,
                  [value]: options2,
                },
              }),
              context2,
            ),
            Promise.resolve());
      },
      list(input2: Dynamic): Dynamic {
        let value: Dynamic = Object.keys(input.content().files).sort();
        return Promise.resolve(
          value
            .map((input3?: Dynamic): Dynamic => FileValue + input3)
            .filter((input3?: Dynamic): Dynamic => input3.startsWith(input2)),
        );
      },
      delete(input2: Dynamic): Dynamic {
        let value: Dynamic = callback(input2);
        if (value === null) return Promise.resolve(false);
        let value2: Dynamic = Object.hasOwn(input.content().files, value);
        value2 &&
          input.updateContent((input3?: Dynamic): Dynamic => {
            let state: Dynamic = {
              ...input3.files,
            };
            delete state[value];
            return {
              files: state,
            };
          });
        return Promise.resolve(value2);
      },
    };
  }
  function setKvClient(input?: Dynamic): Dynamic {
    PlatformFileContentAlias = input;
  }
  function getKvClient(): Dynamic {
    if (!PlatformFileContentAlias)
      throw new Error(
        "kv client not initialized \u2014 call setKvClient() before mounting",
      );
    return PlatformFileContentAlias;
  }
  function stripAppifactPathPrefix(path?: Dynamic): Dynamic {
    return path.startsWith(AppifactValue)
      ? path.slice(AppifactValue.length)
      : path;
  }
  function registerAssetUrl(input?: Dynamic, options?: Dynamic): Dynamic {
    PlatformFileContentCache_2.set(input, options);
  }
  function registerImageFileUrls(input?: Dynamic): Dynamic {
    for (let [value, value2] of Object.entries(input) as Dynamic)
      PlatformFileContentWebpAvifPattern_2.test(value) &&
        PlatformFileContentCache_2.set(
          value,
          "data:" + imageFileMimeType(value) + ";base64," + value2,
        );
  }
  function imageFileMimeType(input?: Dynamic): Dynamic {
    let value: Dynamic = input.slice(input.lastIndexOf(".") + 1).toLowerCase();
    return (
      (
        {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp",
          avif: "image/avif",
          bmp: "image/bmp",
          svg: "image/svg+xml",
        } as Dynamic
      )[value] ?? "application/octet-stream"
    );
  }
  function previewMessageOrigin(): Dynamic {
    return {
      origin: currentHttpOrigin(),
    };
  }
  function currentHttpOrigin(): Dynamic {
    if (typeof location === "undefined") return "null";
    let value: Dynamic = (globalThis as Dynamic).origin ?? location.origin;
    return /^https?:\/\//i.test(value) ? value : "null";
  }
  function resolveProjectAssetUrl(
    project?: Dynamic,
    path?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    return (
      PlatformFileContentCache_2.get(stripAppifactPathPrefix(path)) ??
      `./${stripAppifactPathPrefix(path)}`
    );
  }
  function probePreviewRuntime(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options?.attempts ?? 1,
      value2: Dynamic = options?.timeoutMs ?? 400;
    return new Promise((input2?: Dynamic): Dynamic => {
      let values: Dynamic = new Set(),
        index: Dynamic = 0,
        value3: Dynamic,
        callback: Dynamic = (input3?: Dynamic): Dynamic => {
          let data: Dynamic = input3.data;
          data == null ||
            typeof data != "object" ||
            (typeof data.__om_pong == "string" &&
              values.has(data.__om_pong) &&
              callback2("alive"));
        },
        callback2: Dynamic = (input3?: Dynamic): Dynamic => {
          clearTimeout(value3);
          input.removeEventListener("message", callback);
          input2(input3);
        },
        callback3: Dynamic = (): Dynamic => {
          index += 1;
          let value4: Dynamic = crypto.randomUUID();
          values.add(value4);
          try {
            input.postMessage({
              __om_ping: value4,
            });
          } catch {
            callback2("dead");
            return;
          }
          value3 = setTimeout((): Dynamic => {
            index < value ? callback3() : callback2("dead");
          }, value2);
        };
      input.addEventListener("message", callback);
      input.start();
      callback3();
    });
  }
  function setPreviewGenerationGate(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    PlatformFileContentElementCache.set(input, options);
  }
  function getPreviewGenerationGate(input?: Dynamic): Dynamic {
    return (
      (input && PlatformFileContentElementCache.get(input)) ||
      defaultPreviewGenerationGate
    );
  }
  function hasRoomCapability(): Dynamic {
    // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
    let claude: Dynamic = (globalThis as Dynamic).designHost;
    return (
      typeof claude?.use == "function" ||
      typeof claude?.room?.presence == "function"
    );
  }
  async function requestRoomCapability(): Promise<Dynamic> {
    // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
    let claude: Dynamic = (globalThis as Dynamic).designHost;
    try {
      if (typeof claude?.use == "function") {
        let value: Dynamic = await (0, runtime.requestHostCapability)("room");
        return typeof value == "object" && value !== null ? value : null;
      }
    } catch {
      return null;
    }
    return typeof claude?.room?.presence == "function" ? claude.room : null;
  }
  function roomErrorCode(input?: Dynamic): Dynamic {
    let value: Dynamic =
      typeof input == "object" && input !== null ? input.code : "";
    return typeof value == "string" ? value : "";
  }
  async function publishRoomPresence(input?: Dynamic): Promise<Dynamic> {
    let value: Dynamic = await requestRoomCapability();
    if (typeof value?.presence != "function") return "off";
    try {
      await value.presence.call(value, input);
      return "ok";
    } catch (value2: Dynamic) {
      let value3: Dynamic = roomErrorCode(value2);
      return value3 === "upstream_error"
        ? "retry"
        : (value3 === "invalid_argument" &&
            console.warn("appifact room: rejected presence patch", value2),
          "off");
    }
  }
  function cachedRoomCapability(): Dynamic {
    // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
    let claude: Dynamic = (globalThis as Dynamic).designHost;
    (requestRoomCapabilityValue === undefined ||
      PlatformFileContentAlias_2 !== claude) &&
      ((PlatformFileContentAlias_2 = claude),
      (requestRoomCapabilityValue = requestRoomCapability()));
    return requestRoomCapabilityValue;
  }
  function normalizeRoomPeers(input?: Dynamic): Dynamic {
    if (!Array.isArray(input)) return PlatformFileContentFreezeValue;
    let items: Dynamic = [];
    for (let value of input as Dynamic) {
      if (typeof value != "object" || value === null) continue;
      let value2: Dynamic = value;
      typeof value2.peer == "string" &&
        items.push({
          peer: value2.peer,
          by:
            typeof value2.by == "string" && value2.by !== "" ? value2.by : null,
          isMe: value2.isMe === true,
          sameTab: value2.sameTab === true,
          presence:
            typeof value2.presence == "object" && value2.presence !== null
              ? value2.presence
              : {},
          updatedAt: typeof value2.updatedAt == "number" ? value2.updatedAt : 0,
        });
    }
    return items;
  }
  function subscribeRoomPeers(): Dynamic {
    roomPeerSubscriptionStarted ||
      ((roomPeerSubscriptionStarted = true),
      cachedRoomCapability().then((input?: Dynamic): Dynamic => {
        if (
          !(typeof input?.onPeers != "function" || !roomPeerSubscriptionStarted)
        )
          try {
            let value: Dynamic = input.onPeers.call(
              input,
              (input2?: Dynamic): Dynamic => {
                PlatformFileContentFreezeValueAlias = normalizeRoomPeers(
                  input2.peers,
                );
                for (let value2 of [
                  ...PlatformFileContentSubscribers_4,
                ] as Dynamic)
                  value2();
              },
              (): Dynamic => {
                PlatformFileContentFreezeValueAlias =
                  PlatformFileContentFreezeValue;
                for (let value2 of [
                  ...PlatformFileContentSubscribers_4,
                ] as Dynamic)
                  value2();
              },
            );
            typeof value == "function" &&
              (PlatformFileContentCurrentState = value);
          } catch {}
      }));
  }
  function resetRoomPeers(): Dynamic {
    PlatformFileContentCurrentState?.();
    PlatformFileContentCurrentState = null;
    roomPeerSubscriptionStarted = false;
    PlatformFileContentFreezeValueAlias = PlatformFileContentFreezeValue;
    PlatformFileContentSubscribers_4.clear();
  }
  function hasInvalidEmbedContext(): Dynamic {
    return (
      typeof window !== "undefined" &&
      (window as Dynamic).__appifactEmbed !== undefined &&
      getEmbedContext() === null
    );
  }
  function getEmbedContext(): Dynamic {
    if (PlatformFileContentResolvedValue_12 !== undefined)
      return PlatformFileContentResolvedValue_12;
    let value: Dynamic =
        typeof window === "undefined"
          ? undefined
          : (window as Dynamic).__appifactEmbed,
      value2: Dynamic =
        typeof value == "object" && value !== null ? value : null,
      value3: Dynamic =
        value2 !== null &&
        typeof value2.storePrefix == "string" &&
        PlatformFileContentAZaZPattern_3.test(value2.storePrefix)
          ? value2.storePrefix
          : null,
      value4: Dynamic =
        value2 !== null &&
        typeof value2.memoryScope == "string" &&
        PlatformFileContentAZaZPattern_4.test(value2.memoryScope)
          ? value2.memoryScope
          : null;
    PlatformFileContentResolvedValue_12 =
      value3 !== null && value4 !== null
        ? {
            storePrefix: value3,
            memoryScope: value4,
          }
        : null;
    return PlatformFileContentResolvedValue_12;
  }
  function trackEmbeddedWrite(input?: Dynamic): Dynamic {
    !embeddedWritesTracked ||
      embeddedEditorFrozen ||
      (PlatformFileContentSubscribers_5.add(input),
      input.then(
        (input2?: Dynamic): Dynamic => {
          PlatformFileContentSubscribers_5.delete(input);
          embeddedFreezeRequested &&
            input2 === false &&
            (embeddedWriteFailed = true);
        },
        (): Dynamic => {
          PlatformFileContentSubscribers_5.delete(input);
          embeddedFreezeRequested && (embeddedWriteFailed = true);
        },
      ));
    return input;
  }
  function isEmbedFrozen(): Dynamic {
    return embeddedEditorFrozen;
  }
  async function awaitEmbeddedWrites(input?: Dynamic): Promise<Dynamic> {
    for (; PlatformFileContentSubscribers_5.size > 0; ) {
      let value: Dynamic = input - Date.now();
      if (value <= 0) return false;
      let value2: Dynamic;
      await Promise.race([
        Promise.allSettled([...PlatformFileContentSubscribers_5]),
        new Promise(
          (input2?: Dynamic): Dynamic => (value2 = setTimeout(input2, value)),
        ),
      ]);
      clearTimeout(value2);
    }
    return true;
  }
  function setEmbedSettler(input?: Dynamic): Dynamic {
    PlatformFileContentAlias_3 = input;
  }
  function setEmbedPresenceListener(input?: Dynamic): Dynamic {
    PlatformFileContentAlias_4 = input;
  }
  function setEmbedSilencer(input?: Dynamic): Dynamic {
    PlatformFileContentCurrentState_2 = input;
  }
  function silenceEmbeddedEditor(): Dynamic {
    let value: Dynamic = PlatformFileContentCurrentState_2;
    PlatformFileContentCurrentState_2 = null;
    try {
      value?.();
    } catch (value2: Dynamic) {
      console.error("design: silencing the editor failed", value2);
    }
  }
  function dispatchDesignReady(): Dynamic {
    try {
      (window as Dynamic).frameElement?.dispatchEvent(new Event("designready"));
    } catch {}
  }
  function installEmbeddedLifecycle(input?: Dynamic): Dynamic {
    let __appifactEmbed: Dynamic = (window as Dynamic).__appifactEmbed,
      flag: Dynamic = false;
    embeddedWritesTracked = true;
    embeddedEditorFrozen =
      embeddedFreezeRequested =
      embeddedWriteFailed =
        false;
    __appifactEmbed.setPresence = (input2?: Dynamic): Dynamic => {
      __appifactEmbed.presence = input2;
      PlatformFileContentAlias_4?.();
    };
    let value: Dynamic = null,
      callback: Dynamic = (): Dynamic => {
        if (
          value === null ||
          flag ||
          input.readOnly() ||
          input.loadState?.() !== "live"
        )
          return;
        let value3: Dynamic = value;
        value = null;
        input.title() !== value3 && input.setTitle(value3);
      },
      value2: Dynamic = input.subscribeLoad?.(callback);
    __appifactEmbed.setTitle = (input2?: Dynamic): Dynamic => {
      typeof input2 == "string" && ((value = input2), callback());
    };
    __appifactEmbed.dispose = (): Dynamic => {
      flag ||
        ((flag = true),
        (embeddedEditorFrozen = true),
        value2?.(),
        silenceEmbeddedEditor(),
        input.dispose?.(),
        resetRoomPeers());
    };
    let callback2: Dynamic = async (): Promise<Dynamic> => {
      try {
        await PlatformFileContentAlias_3?.();
      } catch {}
    };
    __appifactEmbed.settle = async (): Promise<Dynamic> => {
      let value3: Dynamic = Date.now() + PlatformFileContentConstant_22;
      embeddedFreezeRequested = true;
      let value4: Dynamic = PlatformFileContentSubscribers_5.size > 0;
      silenceEmbeddedEditor();
      await callback2();
      let flag2: Dynamic = true;
      (value4 || PlatformFileContentSubscribers_5.size > 0) &&
        ((flag2 = await awaitEmbeddedWrites(
          value3 - PlatformFileContentConstant_23,
        )),
        await callback2());
      let callback3: Dynamic = (): Dynamic => flag2 && !embeddedWriteFailed;
      return new Promise((input2?: Dynamic): Dynamic => {
        let callback4: Dynamic = (): Dynamic => {
          let value5: Dynamic = input.syncDetail?.();
          return (
            value5 === undefined ||
            (value5.pending === 0 && value5.inflight === null)
          );
        };
        input.flushNow?.();
        setTimeout((): Dynamic => {
          input.flushNow?.();
          if (callback4()) return input2(callback3());
          if (input.saveState().status === "readonly") return input2(false);
          let value5: Dynamic = setTimeout(
              (): Dynamic => value7(callback4() && callback3()),
              Math.max(0, value3 - Date.now()),
            ),
            value6: Dynamic = input.subscribeSave((): Dynamic => {
              callback4()
                ? value7(callback3())
                : input.saveState().status === "readonly" && value7(false);
            });
          function value7(input3?: Dynamic): Dynamic {
            clearTimeout(value5);
            value6();
            input2(input3);
          }
        }, PlatformFileContentDelayMs);
      });
    };
  }
  function getEmbeddedPresence(): Dynamic {
    if (getEmbedContext() === null) return {};
    let presence: Dynamic = (window as Dynamic).__appifactEmbed.presence;
    if (typeof presence != "object" || presence === null) return {};
    let state: Dynamic = {};
    for (let [value, value2] of Object.entries(presence).slice(
      0,
      24,
    ) as Dynamic)
      value2 === null ||
      typeof value2 == "string" ||
      typeof value2 == "number" ||
      typeof value2 == "boolean"
        ? (state[value] = value2)
        : typeof value2 == "object" &&
          typeof value2.text == "string" &&
          (state[value] = {
            text: value2.text,
          });
    return state;
  }
  function embedMemoryPrefix(): Dynamic {
    let value: Dynamic = getEmbedContext();
    return value === null ? "" : value.memoryScope + "/";
  }
  function prefixDocumentStore(input?: Dynamic, items?: Dynamic): Dynamic {
    return {
      subscribe: (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic =>
        input.subscribe(
          items + input2,
          (input3?: Dynamic, options2?: Dynamic): Dynamic =>
            options(
              input3
                .filter(
                  (input4?: Dynamic): Dynamic => input4.path.startsWith(items),
                )
                .map(
                  (input4?: Dynamic): Dynamic => ({
                    ...input4,
                    path: input4.path.slice(items.length),
                  }),
                ),
              options2,
            ),
          context,
        ),
      set: (input2?: Dynamic, options?: Dynamic): Dynamic =>
        input.set(items + input2, options),
      update: (input2?: Dynamic, options?: Dynamic): Dynamic =>
        input.update(items + input2, options),
      del: (input2?: Dynamic): Dynamic => input.del(items + input2),
    };
  }
  function isPreviewMessage(
    dataset?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (
      (context == null && getPreviewGenerationGate(options).blocked != null) ||
      !options ||
      !("contentWindow" in options) ||
      !options.contentWindow ||
      dataset.source !== options.contentWindow
    )
      return false;
    let value: Dynamic = context ?? previewMessageOrigin()?.origin;
    return value ? dataset.origin === value : false;
  }
  bindRuntimeValue(
    runtime,
    "isNarrowedFileContext",
    () => isNarrowedFileContext,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit",
    () => PlatformFileContentLimit,
    (value) => {
      PlatformFileContentLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_2",
    () => PlatformFileContentLimit_2,
    (value) => {
      PlatformFileContentLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue",
    () => PlatformFileContentResolvedValue,
    (value) => {
      PlatformFileContentResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentFilesBytesConfig",
    () => PlatformFileContentFilesBytesConfig,
    (value) => {
      PlatformFileContentFilesBytesConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_2",
    () => PlatformFileContentResolvedValue_2,
    (value) => {
      PlatformFileContentResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentCache",
    () => PlatformFileContentCache,
    (value) => {
      PlatformFileContentCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSubscribers",
    () => PlatformFileContentSubscribers,
    (value) => {
      PlatformFileContentSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSubscribers_2",
    () => PlatformFileContentSubscribers_2,
    (value) => {
      PlatformFileContentSubscribers_2 = value;
    },
  );
  bindRuntimeValue(runtime, "validateFileName", () => validateFileName);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSubscribers_3",
    () => PlatformFileContentSubscribers_3,
    (value) => {
      PlatformFileContentSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Value_2",
    () => Value_2,
    (value) => {
      Value_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentUDBFFUDFFFPattern",
    () => PlatformFileContentUDBFFUDFFFPattern,
    (value) => {
      PlatformFileContentUDBFFUDFFFPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentIncludes",
    () => PlatformFileContentIncludes,
    (value) => {
      PlatformFileContentIncludes = value;
    },
  );
  bindRuntimeValue(runtime, "isTextFileContent", () => isTextFileContent);
  bindRuntimeValue(runtime, "describeInvalidFile", () => describeInvalidFile);
  bindRuntimeValue(runtime, "getMimeTypeForPath", () => getMimeTypeForPath);
  bindRuntimeValue(
    runtime,
    "isHtmlPath",
    () => isHtmlPath,
    (value) => {
      isHtmlPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "frameRuntimeStartMarker",
    () => frameRuntimeStartMarker,
    (value) => {
      frameRuntimeStartMarker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "frameRuntimeEndMarker",
    () => frameRuntimeEndMarker,
    (value) => {
      frameRuntimeEndMarker = value;
    },
  );
  bindRuntimeValue(runtime, "stripFrameRuntime", () => stripFrameRuntime);
  bindRuntimeValue(runtime, "normalizeFileEntry", () => normalizeFileEntry);
  bindRuntimeValue(
    runtime,
    "getFileContent",
    () => getFileContent,
    (value) => {
      getFileContent = value;
    },
  );
  bindRuntimeValue(runtime, "getEncodedFileBytes", () => getEncodedFileBytes);
  bindRuntimeValue(runtime, "getRawFileBytes", () => getRawFileBytes);
  bindRuntimeValue(
    runtime,
    "describeOversizedFile",
    () => describeOversizedFile,
  );
  bindRuntimeValue(runtime, "fileContentToBytes", () => fileContentToBytes);
  bindRuntimeValue(runtime, "hashFileMap", () => hashFileMap);
  bindRuntimeValue(
    runtime,
    "validatePublishFileMap",
    () => validatePublishFileMap,
  );
  bindRuntimeValue(runtime, "splitPublishBatches", () => splitPublishBatches);
  bindRuntimeValue(runtime, "hasInjectedRuntime", () => hasInjectedRuntime);
  bindRuntimeValue(
    runtime,
    "encodePathSegments",
    () => encodePathSegments,
    (value) => {
      encodePathSegments = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasMetadataFile",
    () => canvasMetadataFile,
    (value) => {
      canvasMetadataFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLabel",
    () => PlatformFileContentLabel,
    (value) => {
      PlatformFileContentLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentGridSizeCountSizeConfig",
    () => PlatformFileContentGridSizeCountSizeConfig,
    (value) => {
      PlatformFileContentGridSizeCountSizeConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant",
    () => PlatformFileContentConstant,
    (value) => {
      PlatformFileContentConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentPattern",
    () => PlatformFileContentPattern,
    (value) => {
      PlatformFileContentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentExpandPrintPaperValues",
    () => PlatformFileContentExpandPrintPaperValues,
    (value) => {
      PlatformFileContentExpandPrintPaperValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardAppearanceProperties",
    () => artboardAppearanceProperties,
  );
  bindRuntimeValue(runtime, "resolveArtboardGuide", () => resolveArtboardGuide);
  bindRuntimeValue(
    runtime,
    "normalizeArtboardRadius",
    () => normalizeArtboardRadius,
  );
  bindRuntimeValue(
    runtime,
    "artboardRadiusCorners",
    () => artboardRadiusCorners,
  );
  bindRuntimeValue(runtime, "artboardRadiusCss", () => artboardRadiusCss);
  bindRuntimeValue(runtime, "updateArtboardRadius", () => updateArtboardRadius);
  bindRuntimeValue(runtime, "parseArtboardGuides", () => parseArtboardGuides);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_3",
    () => PlatformFileContentLimit_3,
    (value) => {
      PlatformFileContentLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimitAlias",
    () => PlatformFileContentLimitAlias,
    (value) => {
      PlatformFileContentLimitAlias = value;
    },
  );
  bindRuntimeValue(runtime, "maxDesignPages", () => maxDesignPages);
  bindRuntimeValue(runtime, "parseAnnotationCrop", () => parseAnnotationCrop);
  bindRuntimeValue(runtime, "updateAnnotationCrop", () => updateAnnotationCrop);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentBackgroundBackgroundColorOpacityValues",
    () => PlatformFileContentBackgroundBackgroundColorOpacityValues,
    (value) => {
      PlatformFileContentBackgroundBackgroundColorOpacityValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentPattern_2",
    () => PlatformFileContentPattern_2,
    (value) => {
      PlatformFileContentPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAZPattern",
    () => PlatformFileContentAZPattern,
    (value) => {
      PlatformFileContentAZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentRgbaHslaPattern",
    () => PlatformFileContentRgbaHslaPattern,
    (value) => {
      PlatformFileContentRgbaHslaPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentBorderStyleObjectFitOpacityConfig",
    () => PlatformFileContentBorderStyleObjectFitOpacityConfig,
    (value) => {
      PlatformFileContentBorderStyleObjectFitOpacityConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTrim",
    () => PlatformFileContentTrim,
    (value) => {
      PlatformFileContentTrim = value;
    },
  );
  bindRuntimeValue(runtime, "updateAnnotationAlt", () => updateAnnotationAlt);
  bindRuntimeValue(
    runtime,
    "updateAnnotationVideo",
    () => updateAnnotationVideo,
  );
  bindRuntimeValue(
    runtime,
    "annotationArrowHeads",
    () => annotationArrowHeads,
    (value) => {
      annotationArrowHeads = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateAnnotationArrowHeads",
    () => updateAnnotationArrowHeads,
  );
  bindRuntimeValue(runtime, "updateAnnotationCss", () => updateAnnotationCss);
  bindRuntimeValue(
    runtime,
    "normalizeAnnotationCss",
    () => normalizeAnnotationCss,
    (value) => {
      normalizeAnnotationCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isShapeAnnotation",
    () => isShapeAnnotation,
    (value) => {
      isShapeAnnotation = value;
    },
  );
  bindRuntimeValue(runtime, "annotationBounds", () => annotationBounds);
  bindRuntimeValue(
    runtime,
    "annotationVisibleBounds",
    () => annotationVisibleBounds,
  );
  bindRuntimeValue(runtime, "updateShapeColor", () => updateShapeColor);
  bindRuntimeValue(
    runtime,
    "updateAnnotationColor",
    () => updateAnnotationColor,
  );
  bindRuntimeValue(runtime, "moveAnnotation", () => moveAnnotation);
  bindRuntimeValue(runtime, "annotationGeometry", () => annotationGeometry);
  bindRuntimeValue(
    runtime,
    "normalizeRotationDegrees",
    () => normalizeRotationDegrees,
  );
  bindRuntimeValue(
    runtime,
    "annotationRotation",
    () => annotationRotation,
    (value) => {
      annotationRotation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rotatedAnnotationBounds",
    () => rotatedAnnotationBounds,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSMLConfig",
    () => PlatformFileContentSMLConfig,
    (value) => {
      PlatformFileContentSMLConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_2",
    () => PlatformFileContentConstant_2,
    (value) => {
      PlatformFileContentConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_3",
    () => PlatformFileContentConstant_3,
    (value) => {
      PlatformFileContentConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_4",
    () => PlatformFileContentConstant_4,
    (value) => {
      PlatformFileContentConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentGrayRedOrangeValues",
    () => PlatformFileContentGrayRedOrangeValues,
    (value) => {
      PlatformFileContentGrayRedOrangeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentGrayRedOrangeValuesAlias",
    () => PlatformFileContentGrayRedOrangeValuesAlias,
    (value) => {
      PlatformFileContentGrayRedOrangeValuesAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentNoteTitle1Config",
    () => PlatformFileContentNoteTitle1Config,
    (value) => {
      PlatformFileContentNoteTitle1Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "annotationTextStyle",
    () => annotationTextStyle,
    (value) => {
      annotationTextStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentHas",
    () => PlatformFileContentHas,
    (value) => {
      PlatformFileContentHas = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentMax",
    () => PlatformFileContentMax,
    (value) => {
      PlatformFileContentMax = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentKind",
    () => PlatformFileContentKind,
    (value) => {
      PlatformFileContentKind = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentMaxW",
    () => PlatformFileContentMaxW,
    (value) => {
      PlatformFileContentMaxW = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentHandler",
    () => PlatformFileContentHandler,
    (value) => {
      PlatformFileContentHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentKind_2",
    () => PlatformFileContentKind_2,
    (value) => {
      PlatformFileContentKind_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateAnnotationTextStyle",
    () => updateAnnotationTextStyle,
  );
  bindRuntimeValue(
    runtime,
    "validCoverArtboard",
    () => validCoverArtboard,
    (value) => {
      validCoverArtboard = value;
    },
  );
  bindRuntimeValue(runtime, "designPageId", () => designPageId);
  bindRuntimeValue(runtime, "findArtboardByName", () => findArtboardByName);
  bindRuntimeValue(
    runtime,
    "artboardNameWithoutExtension",
    () => artboardNameWithoutExtension,
    (value) => {
      artboardNameWithoutExtension = value;
    },
  );
  bindRuntimeValue(runtime, "createPageId", () => createPageId);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_5",
    () => PlatformFileContentConstant_5,
    (value) => {
      PlatformFileContentConstant_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_6",
    () => PlatformFileContentConstant_6,
    (value) => {
      PlatformFileContentConstant_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_7",
    () => PlatformFileContentConstant_7,
    (value) => {
      PlatformFileContentConstant_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_8",
    () => PlatformFileContentConstant_8,
    (value) => {
      PlatformFileContentConstant_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_9",
    () => PlatformFileContentConstant_9,
    (value) => {
      PlatformFileContentConstant_9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_10",
    () => PlatformFileContentConstant_10,
    (value) => {
      PlatformFileContentConstant_10 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_11",
    () => PlatformFileContentConstant_11,
    (value) => {
      PlatformFileContentConstant_11 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_12",
    () => PlatformFileContentConstant_12,
    (value) => {
      PlatformFileContentConstant_12 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_13",
    () => PlatformFileContentConstant_13,
    (value) => {
      PlatformFileContentConstant_13 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_14",
    () => PlatformFileContentConstant_14,
    (value) => {
      PlatformFileContentConstant_14 = value;
    },
  );
  bindRuntimeValue(runtime, "annotationTextFit", () => annotationTextFit);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentMin",
    () => PlatformFileContentMin,
    (value) => {
      PlatformFileContentMin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLh",
    () => PlatformFileContentLh,
    (value) => {
      PlatformFileContentLh = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentMax_2",
    () => PlatformFileContentMax_2,
    (value) => {
      PlatformFileContentMax_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentMatch",
    () => PlatformFileContentMatch,
    (value) => {
      PlatformFileContentMatch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentL",
    () => PlatformFileContentL,
    (value) => {
      PlatformFileContentL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTest",
    () => PlatformFileContentTest,
    (value) => {
      PlatformFileContentTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_4",
    () => PlatformFileContentLimit_4,
    (value) => {
      PlatformFileContentLimit_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_5",
    () => PlatformFileContentLimit_5,
    (value) => {
      PlatformFileContentLimit_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_15",
    () => PlatformFileContentConstant_15,
    (value) => {
      PlatformFileContentConstant_15 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_16",
    () => PlatformFileContentConstant_16,
    (value) => {
      PlatformFileContentConstant_16 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_17",
    () => PlatformFileContentConstant_17,
    (value) => {
      PlatformFileContentConstant_17 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_6",
    () => PlatformFileContentLimit_6,
    (value) => {
      PlatformFileContentLimit_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_3",
    () => PlatformFileContentResolvedValue_3,
    (value) => {
      PlatformFileContentResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_18",
    () => PlatformFileContentConstant_18,
    (value) => {
      PlatformFileContentConstant_18 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentRectOvalLineConfig",
    () => PlatformFileContentRectOvalLineConfig,
    (value) => {
      PlatformFileContentRectOvalLineConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_19",
    () => PlatformFileContentConstant_19,
    (value) => {
      PlatformFileContentConstant_19 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "annotationLineEndpoints",
    () => annotationLineEndpoints,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_20",
    () => PlatformFileContentConstant_20,
    (value) => {
      PlatformFileContentConstant_20 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTest_2",
    () => PlatformFileContentTest_2,
    (value) => {
      PlatformFileContentTest_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTest_3",
    () => PlatformFileContentTest_3,
    (value) => {
      PlatformFileContentTest_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_7",
    () => PlatformFileContentLimit_7,
    (value) => {
      PlatformFileContentLimit_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTrim_2",
    () => PlatformFileContentTrim_2,
    (value) => {
      PlatformFileContentTrim_2 = value;
    },
  );
  bindRuntimeValue(runtime, "isArtboardFile", () => isArtboardFile);
  bindRuntimeValue(runtime, "isDesignSystemFile", () => isDesignSystemFile);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentMin_2",
    () => PlatformFileContentMin_2,
    (value) => {
      PlatformFileContentMin_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_21",
    () => PlatformFileContentConstant_21,
    (value) => {
      PlatformFileContentConstant_21 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSlice",
    () => PlatformFileContentSlice,
    (value) => {
      PlatformFileContentSlice = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSlice_2",
    () => PlatformFileContentSlice_2,
    (value) => {
      PlatformFileContentSlice_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTest_4",
    () => PlatformFileContentTest_4,
    (value) => {
      PlatformFileContentTest_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentHandler_2",
    () => PlatformFileContentHandler_2,
    (value) => {
      PlatformFileContentHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentIncludes_2",
    () => PlatformFileContentIncludes_2,
    (value) => {
      PlatformFileContentIncludes_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentIncludes_3",
    () => PlatformFileContentIncludes_3,
    (value) => {
      PlatformFileContentIncludes_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentHandler_3",
    () => PlatformFileContentHandler_3,
    (value) => {
      PlatformFileContentHandler_3 = value;
    },
  );
  bindRuntimeValue(runtime, "parseShapeAnnotation", () => parseShapeAnnotation);
  bindRuntimeValue(runtime, "parseAnnotation", () => parseAnnotation);
  bindRuntimeValue(runtime, "parseDesignPages", () => parseDesignPages);
  bindRuntimeValue(
    runtime,
    "normalizeDesignLaunch",
    () => normalizeDesignLaunch,
    (value) => {
      normalizeDesignLaunch = value;
    },
  );
  bindRuntimeValue(runtime, "parseArtboardSpec", () => parseArtboardSpec);
  bindRuntimeValue(
    runtime,
    "artboardSpecFromProps",
    () => artboardSpecFromProps,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentScriptDataPropsPattern",
    () => PlatformFileContentScriptDataPropsPattern,
    (value) => {
      PlatformFileContentScriptDataPropsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readEmbeddedArtboardProps",
    () => readEmbeddedArtboardProps,
  );
  bindRuntimeValue(runtime, "nextArtboardPosition", () => nextArtboardPosition);
  bindRuntimeValue(runtime, "parseCanvasMetadata", () => parseCanvasMetadata);
  bindRuntimeValue(
    runtime,
    "serializeCanvasMetadata",
    () => serializeCanvasMetadata,
  );
  bindRuntimeValue(runtime, "artboardStackOrder", () => artboardStackOrder);
  bindRuntimeValue(
    runtime,
    "reorderArtboardsOnPages",
    () => reorderArtboardsOnPages,
  );
  bindRuntimeValue(runtime, "uniqueArtboardFile", () => uniqueArtboardFile);
  bindRuntimeValue(
    runtime,
    "artboardDisplayName",
    () => artboardDisplayName,
    (value) => {
      artboardDisplayName = value;
    },
  );
  bindRuntimeValue(runtime, "nextArtboardTitle", () => nextArtboardTitle);
  bindRuntimeValue(
    runtime,
    "uniqueElementArtboardTitle",
    () => uniqueElementArtboardTitle,
  );
  bindRuntimeValue(
    runtime,
    "duplicateArtboardTitle",
    () => duplicateArtboardTitle,
  );
  bindRuntimeValue(
    runtime,
    "annotationKindCategory",
    () => annotationKindCategory,
    (value) => {
      annotationKindCategory = value;
    },
  );
  bindRuntimeValue(runtime, "createAnnotationId", () => createAnnotationId);
  bindRuntimeValue(runtime, "blankDcDocument", () => blankDcDocument);
  bindRuntimeValue(
    runtime,
    "replaceDesignArtboards",
    () => replaceDesignArtboards,
  );
  bindRuntimeValue(
    runtime,
    "designArtboardsMatchFiles",
    () => designArtboardsMatchFiles,
  );
  bindRuntimeValue(runtime, "designPageContents", () => designPageContents);
  bindRuntimeValue(
    runtime,
    "replaceDesignPageContents",
    () => replaceDesignPageContents,
  );
  bindRuntimeValue(
    runtime,
    "DesignValue",
    () => DesignValue,
    (value) => {
      DesignValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MetaValue",
    () => MetaValue,
    (value) => {
      MetaValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_4",
    () => PlatformFileContentResolvedValue_4,
    (value) => {
      PlatformFileContentResolvedValue_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SourceValue",
    () => SourceValue,
    (value) => {
      SourceValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_5",
    () => PlatformFileContentResolvedValue_5,
    (value) => {
      PlatformFileContentResolvedValue_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BoardsValue",
    () => BoardsValue,
    (value) => {
      BoardsValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FilesValue",
    () => FilesValue,
    (value) => {
      FilesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesValue",
    () => NotesValue,
    (value) => {
      NotesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_6",
    () => PlatformFileContentResolvedValue_6,
    (value) => {
      PlatformFileContentResolvedValue_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_7",
    () => PlatformFileContentResolvedValue_7,
    (value) => {
      PlatformFileContentResolvedValue_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_8",
    () => PlatformFileContentResolvedValue_8,
    (value) => {
      PlatformFileContentResolvedValue_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_9",
    () => PlatformFileContentResolvedValue_9,
    (value) => {
      PlatformFileContentResolvedValue_9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentWebpAvifPattern",
    () => PlatformFileContentWebpAvifPattern,
    (value) => {
      PlatformFileContentWebpAvifPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentNodeModulesPattern",
    () => PlatformFileContentNodeModulesPattern,
    (value) => {
      PlatformFileContentNodeModulesPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentJsonPattern",
    () => PlatformFileContentJsonPattern,
    (value) => {
      PlatformFileContentJsonPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSupportedProjectAsset",
    () => isSupportedProjectAsset,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_8",
    () => PlatformFileContentLimit_8,
    (value) => {
      PlatformFileContentLimit_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAZaZAZaZPattern",
    () => PlatformFileContentAZaZAZaZPattern,
    (value) => {
      PlatformFileContentAZaZAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentPattern_3",
    () => PlatformFileContentPattern_3,
    (value) => {
      PlatformFileContentPattern_3 = value;
    },
  );
  bindRuntimeValue(runtime, "isSafeProjectPath", () => isSafeProjectPath);
  bindRuntimeValue(
    runtime,
    "ProjectValue",
    () => ProjectValue,
    (value) => {
      ProjectValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isProjectTextFilePath",
    () => isProjectTextFilePath,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentPattern_4",
    () => PlatformFileContentPattern_4,
    (value) => {
      PlatformFileContentPattern_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_10",
    () => PlatformFileContentResolvedValue_10,
    (value) => {
      PlatformFileContentResolvedValue_10 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isTypeDeclarationPath",
    () => isTypeDeclarationPath,
  );
  bindRuntimeValue(runtime, "isFullProjectPath", () => isFullProjectPath);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAZaZPattern",
    () => PlatformFileContentAZaZPattern,
    (value) => {
      PlatformFileContentAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTextEncoder",
    () => PlatformFileContentTextEncoder,
    (value) => {
      PlatformFileContentTextEncoder = value;
    },
  );
  bindRuntimeValue(runtime, "hashProjectFileKey", () => hashProjectFileKey);
  bindRuntimeValue(
    runtime,
    "encodeStorePathSegment",
    () => encodeStorePathSegment,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentXYWValues",
    () => PlatformFileContentXYWValues,
    (value) => {
      PlatformFileContentXYWValues = value;
    },
  );
  bindRuntimeValue(runtime, "artboardDocument", () => artboardDocument);
  bindRuntimeValue(runtime, "annotationDocument", () => annotationDocument);
  bindRuntimeValue(runtime, "projectFileDocument", () => projectFileDocument);
  bindRuntimeValue(runtime, "canvasMetaDocument", () => canvasMetaDocument);
  bindRuntimeValue(
    runtime,
    "ClaudeDesignValue",
    () => ClaudeDesignValue,
    (value) => {
      ClaudeDesignValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_9",
    () => PlatformFileContentLimit_9,
    (value) => {
      PlatformFileContentLimit_9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAZaZPattern_2",
    () => PlatformFileContentAZaZPattern_2,
    (value) => {
      PlatformFileContentAZaZPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignPValue",
    () => DesignPValue,
    (value) => {
      DesignPValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentPattern_5",
    () => PlatformFileContentPattern_5,
    (value) => {
      PlatformFileContentPattern_5 = value;
    },
  );
  bindRuntimeValue(runtime, "designSourceDocument", () => designSourceDocument);
  bindRuntimeValue(runtime, "designSourceRefusal", () => designSourceRefusal);
  bindRuntimeValue(runtime, "parseDesignSource", () => parseDesignSource);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentFilesValue",
    () => PlatformFileContentFilesValue,
    (value) => {
      PlatformFileContentFilesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_11",
    () => PlatformFileContentResolvedValue_11,
    (value) => {
      PlatformFileContentResolvedValue_11 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentLimit_10",
    () => PlatformFileContentLimit_10,
    (value) => {
      PlatformFileContentLimit_10 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTextEncoder_2",
    () => PlatformFileContentTextEncoder_2,
    (value) => {
      PlatformFileContentTextEncoder_2 = value;
    },
  );
  bindRuntimeValue(runtime, "parseDesignContent", () => parseDesignContent);
  bindRuntimeValue(runtime, "getDocumentFileCap", () => getDocumentFileCap);
  bindRuntimeValue(
    runtime,
    "createDesignDocumentStore",
    () => createDesignDocumentStore,
  );
  bindRuntimeValue(runtime, "primaryDesignFile", () => primaryDesignFile);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentTextEncoder_3",
    () => PlatformFileContentTextEncoder_3,
    (value) => {
      PlatformFileContentTextEncoder_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FileValue",
    () => FileValue,
    (value) => {
      FileValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentOverPerFilePattern",
    () => PlatformFileContentOverPerFilePattern,
    (value) => {
      PlatformFileContentOverPerFilePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileCapFailureMessage",
    () => fileCapFailureMessage,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentHandler_4",
    () => PlatformFileContentHandler_4,
    (value) => {
      PlatformFileContentHandler_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createDocumentKvAdapter",
    () => createDocumentKvAdapter,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAlias",
    () => PlatformFileContentAlias,
    (value) => {
      PlatformFileContentAlias = value;
    },
  );
  bindRuntimeValue(runtime, "setKvClient", () => setKvClient);
  bindRuntimeValue(runtime, "getKvClient", () => getKvClient);
  bindRuntimeValue(
    runtime,
    "AppifactValue",
    () => AppifactValue,
    (value) => {
      AppifactValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripAppifactPathPrefix",
    () => stripAppifactPathPrefix,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentBeforeWriteVersionOfState",
    () => PlatformFileContentBeforeWriteVersionOfState,
    (value) => {
      PlatformFileContentBeforeWriteVersionOfState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentController",
    () => PlatformFileContentController,
    (value) => {
      PlatformFileContentController = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentCache_2",
    () => PlatformFileContentCache_2,
    (value) => {
      PlatformFileContentCache_2 = value;
    },
  );
  bindRuntimeValue(runtime, "registerAssetUrl", () => registerAssetUrl);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentWebpAvifPattern_2",
    () => PlatformFileContentWebpAvifPattern_2,
    (value) => {
      PlatformFileContentWebpAvifPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registerImageFileUrls",
    () => registerImageFileUrls,
  );
  bindRuntimeValue(
    runtime,
    "projectFilesystem",
    () => projectFilesystem,
    (value) => {
      projectFilesystem = value;
    },
  );
  bindRuntimeValue(runtime, "imageFileMimeType", () => imageFileMimeType);
  bindRuntimeValue(runtime, "previewMessageOrigin", () => previewMessageOrigin);
  bindRuntimeValue(runtime, "currentHttpOrigin", () => currentHttpOrigin);
  bindRuntimeValue(
    runtime,
    "resolveProjectAssetUrl",
    () => resolveProjectAssetUrl,
  );
  bindRuntimeValue(runtime, "probePreviewRuntime", () => probePreviewRuntime);
  bindRuntimeValue(
    runtime,
    "PreviewGenerationGate",
    () => PreviewGenerationGate,
    (value) => {
      PreviewGenerationGate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultPreviewGenerationGate",
    () => defaultPreviewGenerationGate,
    (value) => {
      defaultPreviewGenerationGate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentElementCache",
    () => PlatformFileContentElementCache,
    (value) => {
      PlatformFileContentElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setPreviewGenerationGate",
    () => setPreviewGenerationGate,
  );
  bindRuntimeValue(
    runtime,
    "getPreviewGenerationGate",
    () => getPreviewGenerationGate,
  );
  bindRuntimeValue(runtime, "hasRoomCapability", () => hasRoomCapability);
  bindRuntimeValue(
    runtime,
    "requestRoomCapability",
    () => requestRoomCapability,
  );
  bindRuntimeValue(runtime, "roomErrorCode", () => roomErrorCode);
  bindRuntimeValue(runtime, "publishRoomPresence", () => publishRoomPresence);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAlias_2",
    () => PlatformFileContentAlias_2,
    (value) => {
      PlatformFileContentAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "requestRoomCapabilityValue",
    () => requestRoomCapabilityValue,
    (value) => {
      requestRoomCapabilityValue = value;
    },
  );
  bindRuntimeValue(runtime, "cachedRoomCapability", () => cachedRoomCapability);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentFreezeValue",
    () => PlatformFileContentFreezeValue,
    (value) => {
      PlatformFileContentFreezeValue = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeRoomPeers", () => normalizeRoomPeers);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentFreezeValueAlias",
    () => PlatformFileContentFreezeValueAlias,
    (value) => {
      PlatformFileContentFreezeValueAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSubscribers_4",
    () => PlatformFileContentSubscribers_4,
    (value) => {
      PlatformFileContentSubscribers_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomPeerSubscriptionStarted",
    () => roomPeerSubscriptionStarted,
    (value) => {
      roomPeerSubscriptionStarted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentCurrentState",
    () => PlatformFileContentCurrentState,
    (value) => {
      PlatformFileContentCurrentState = value;
    },
  );
  bindRuntimeValue(runtime, "subscribeRoomPeers", () => subscribeRoomPeers);
  bindRuntimeValue(runtime, "resetRoomPeers", () => resetRoomPeers);
  bindRuntimeValue(
    runtime,
    "roomPeersStore",
    () => roomPeersStore,
    (value) => {
      roomPeersStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAZaZPattern_3",
    () => PlatformFileContentAZaZPattern_3,
    (value) => {
      PlatformFileContentAZaZPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAZaZPattern_4",
    () => PlatformFileContentAZaZPattern_4,
    (value) => {
      PlatformFileContentAZaZPattern_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentResolvedValue_12",
    () => PlatformFileContentResolvedValue_12,
    (value) => {
      PlatformFileContentResolvedValue_12 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasInvalidEmbedContext",
    () => hasInvalidEmbedContext,
  );
  bindRuntimeValue(runtime, "getEmbedContext", () => getEmbedContext);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentSubscribers_5",
    () => PlatformFileContentSubscribers_5,
    (value) => {
      PlatformFileContentSubscribers_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedWritesTracked",
    () => embeddedWritesTracked,
    (value) => {
      embeddedWritesTracked = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedEditorFrozen",
    () => embeddedEditorFrozen,
    (value) => {
      embeddedEditorFrozen = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedFreezeRequested",
    () => embeddedFreezeRequested,
    (value) => {
      embeddedFreezeRequested = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedWriteFailed",
    () => embeddedWriteFailed,
    (value) => {
      embeddedWriteFailed = value;
    },
  );
  bindRuntimeValue(runtime, "trackEmbeddedWrite", () => trackEmbeddedWrite);
  bindRuntimeValue(runtime, "isEmbedFrozen", () => isEmbedFrozen);
  bindRuntimeValue(runtime, "awaitEmbeddedWrites", () => awaitEmbeddedWrites);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAlias_3",
    () => PlatformFileContentAlias_3,
    (value) => {
      PlatformFileContentAlias_3 = value;
    },
  );
  bindRuntimeValue(runtime, "setEmbedSettler", () => setEmbedSettler);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentAlias_4",
    () => PlatformFileContentAlias_4,
    (value) => {
      PlatformFileContentAlias_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setEmbedPresenceListener",
    () => setEmbedPresenceListener,
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentCurrentState_2",
    () => PlatformFileContentCurrentState_2,
    (value) => {
      PlatformFileContentCurrentState_2 = value;
    },
  );
  bindRuntimeValue(runtime, "setEmbedSilencer", () => setEmbedSilencer);
  bindRuntimeValue(
    runtime,
    "silenceEmbeddedEditor",
    () => silenceEmbeddedEditor,
  );
  bindRuntimeValue(runtime, "dispatchDesignReady", () => dispatchDesignReady);
  bindRuntimeValue(
    runtime,
    "PlatformFileContentDelayMs",
    () => PlatformFileContentDelayMs,
    (value) => {
      PlatformFileContentDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_22",
    () => PlatformFileContentConstant_22,
    (value) => {
      PlatformFileContentConstant_22 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileContentConstant_23",
    () => PlatformFileContentConstant_23,
    (value) => {
      PlatformFileContentConstant_23 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installEmbeddedLifecycle",
    () => installEmbeddedLifecycle,
  );
  bindRuntimeValue(runtime, "getEmbeddedPresence", () => getEmbeddedPresence);
  bindRuntimeValue(runtime, "embedMemoryPrefix", () => embedMemoryPrefix);
  bindRuntimeValue(runtime, "prefixDocumentStore", () => prefixDocumentStore);
  bindRuntimeValue(runtime, "isPreviewMessage", () => isPreviewMessage);
  return () => {
    PlatformFileContentLimit = 256;
    PlatformFileContentLimit_2 = 512;
    PlatformFileContentResolvedValue = 16 * 1024 * 1024;
    PlatformFileContentFilesBytesConfig = {
      files: 512,
      bytes: 256 * 1024 * 1024,
    };
    PlatformFileContentResolvedValue_2 = 15 * 1024 * 1024;
    PlatformFileContentCache = new Map([
      ["html", "text/html"],
      ["htm", "text/html"],
      ["css", "text/css"],
      ["js", "text/javascript"],
      ["mjs", "text/javascript"],
      ["json", "application/json"],
      ["webmanifest", "application/manifest+json"],
      ["txt", "text/plain"],
      ["md", "text/markdown"],
      ["xml", "application/xml"],
      ["svg", "image/svg+xml"],
      ["png", "image/png"],
      ["jpg", "image/jpeg"],
      ["jpeg", "image/jpeg"],
      ["gif", "image/gif"],
      ["webp", "image/webp"],
      ["avif", "image/avif"],
      ["ico", "image/x-icon"],
      ["woff", "font/woff"],
      ["woff2", "font/woff2"],
      ["ttf", "font/ttf"],
      ["otf", "font/otf"],
      ["mp3", "audio/mpeg"],
      ["wav", "audio/wav"],
      ["mp4", "video/mp4"],
      ["webm", "video/webm"],
      ["pdf", "application/pdf"],
      ["wasm", "application/wasm"],
    ]);
    PlatformFileContentSubscribers = new Set([
      "text/html",
      "text/css",
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/javascript",
      "application/javascript",
      "application/json",
      "application/manifest+json",
      "application/xml",
      "text/xml",
      "application/wasm",
      "image/svg+xml",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/avif",
      "image/x-icon",
      "image/vnd.microsoft.icon",
      "font/woff",
      "font/woff2",
      "font/ttf",
      "font/otf",
      "application/font-woff",
      "application/font-woff2",
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "application/pdf",
      "application/zip+dotlottie",
    ]);
    PlatformFileContentSubscribers_2 = new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "application/x-figma",
    ]);
    PlatformFileContentSubscribers_3 = new Set([
      "text/html",
      "text/ldx",
      "text/css",
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/javascript",
      "application/javascript",
      "application/json",
      "application/manifest+json",
      "application/xml",
      "text/xml",
      "image/svg+xml",
    ]);
    Value_2 = "\uFFFD";
    PlatformFileContentUDBFFUDFFFPattern =
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    PlatformFileContentIncludes = (input?: Dynamic): Dynamic =>
      input.includes(Value_2) ||
      PlatformFileContentUDBFFUDFFFPattern.test(input);
    isHtmlPath = (input?: Dynamic): Dynamic => /\.html?$/i.test(input);
    frameRuntimeStartMarker = "<\!-- frame-runtime -->";
    frameRuntimeEndMarker = "<\!-- /frame-runtime -->";
    getFileContent = (input?: Dynamic): Dynamic =>
      typeof input == "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? input.content
        : input;
    encodePathSegments = (input?: Dynamic): Dynamic =>
      input.split("/").map(encodeURIComponent).join("/");
    canvasMetadataFile = "canvas.json";
    PlatformFileContentLabel = "rgba(255, 0, 0, 0.1)";
    PlatformFileContentGridSizeCountSizeConfig = {
      gridSize: {
        min: 1,
        max: 2e3,
      },
      count: {
        min: 1,
        max: 64,
      },
      size: {
        min: 1,
        max: 4e3,
      },
      gutter: {
        min: 0,
        max: 4e3,
      },
      margin: {
        min: 0,
        max: 4e3,
      },
      offset: {
        min: 0,
        max: 8e3,
      },
    };
    PlatformFileContentConstant = 1e3;
    PlatformFileContentPattern =
      /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|hsl)a?\([0-9.,%\s/]{1,40}\))$/i;
    PlatformFileContentExpandPrintPaperValues = [
      "expand",
      "print",
      "paper",
      "is_interactive",
      "frameless",
      "guides",
      "radius",
    ];
    PlatformFileContentLimit_3 = 40;
    PlatformFileContentLimitAlias = PlatformFileContentLimit_3;
    PlatformFileContentBackgroundBackgroundColorOpacityValues = [
      "background",
      "background-color",
      "opacity",
      "border-radius",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
      "border-style",
      "border-color",
      "border-width",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "box-shadow",
      "filter",
      "backdrop-filter",
      "object-fit",
      "object-position",
      "stroke",
      "stroke-width",
    ];
    PlatformFileContentPattern_2 = /^[a-z0-9#%(),.\/ +-]{1,1200}$/i;
    PlatformFileContentAZPattern = /([a-z-]+)\(/gi;
    PlatformFileContentRgbaHslaPattern =
      /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|(repeating-)?(linear|radial|conic)-gradient|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|opacity|saturate|sepia)$/i;
    PlatformFileContentBorderStyleObjectFitOpacityConfig = {
      "border-style": /^(none|solid|dashed|dotted|double)$/,
      "object-fit": /^(fill|contain|cover|none|scale-down)$/,
      opacity: /^(\d{1,3}(\.\d{1,6})?|\.\d{1,6}|\d{1,3}(\.\d{1,3})?%)$/,
      "stroke-width": /^\d{1,3}(\.\d{1,2})?(px)?$/,
    };
    PlatformFileContentTrim = (input?: Dynamic, options?: Dynamic): Dynamic => {
      if (typeof options != "string") return null;
      let value: Dynamic = options.trim();
      if (!PlatformFileContentPattern_2.test(value)) return null;
      let value2: Dynamic =
        PlatformFileContentBorderStyleObjectFitOpacityConfig[input];
      if (value2 !== undefined)
        return value2.test(value)
          ? input === "opacity" && !value.endsWith("%") && parseFloat(value) > 1
            ? "1"
            : value
          : null;
      if (
        (value.match(/\(/g) ?? []).length !==
        [...value.matchAll(PlatformFileContentAZPattern)].length
      )
        return null;
      for (let value3 of value.matchAll(
        PlatformFileContentAZPattern,
      ) as Dynamic)
        if (!PlatformFileContentRgbaHslaPattern.test(value3[1])) return null;
      return input === "stroke" && /gradient|^none$/i.test(value)
        ? null
        : value;
    };
    annotationArrowHeads = (source?: Dynamic): Dynamic => ({
      start: source.headStart ?? "none",
      end: source.kind === "arrow" ? (source.headEnd ?? "filled") : "none",
    });
    normalizeAnnotationCss = (input?: Dynamic): Dynamic => {
      if (input === null || typeof input != "object" || Array.isArray(input))
        return;
      let value: Dynamic = input,
        state: Dynamic = {};
      for (let value2 of PlatformFileContentBackgroundBackgroundColorOpacityValues as Dynamic) {
        let value3: Dynamic = PlatformFileContentTrim(value2, value[value2]);
        value3 !== null && (state[value2] = value3);
      }
      return Object.keys(state).length > 0 ? state : undefined;
    };
    isShapeAnnotation = (source?: Dynamic): Dynamic =>
      source.kind === "rect" ||
      source.kind === "oval" ||
      source.kind === "line" ||
      source.kind === "arrow" ||
      source.kind === "pen" ||
      source.kind === "image";
    annotationRotation = (source?: Dynamic): Dynamic =>
      source.kind === "line" || source.kind === "arrow"
        ? 0
        : (source.rotate ?? 0);
    PlatformFileContentSMLConfig = {
      s: 14,
      m: 24,
      l: 40,
      xl: 72,
      xxl: 120,
    };
    PlatformFileContentConstant_2 = 14;
    PlatformFileContentConstant_3 = 8;
    PlatformFileContentConstant_4 = 400;
    PlatformFileContentGrayRedOrangeValues = [
      "gray",
      "red",
      "orange",
      "green",
      "teal",
      "blue",
      "purple",
      "pink",
    ];
    PlatformFileContentGrayRedOrangeValuesAlias =
      PlatformFileContentGrayRedOrangeValues;
    PlatformFileContentNoteTitle1Config = {
      note: {
        size: PlatformFileContentConstant_2,
        kind: "note",
        bold: false,
        italic: false,
        color: "default",
        fill: "default",
      },
      title1: {
        size: PlatformFileContentSMLConfig.xl,
        kind: "title1",
        bold: true,
        italic: false,
        color: "default",
        fill: "default",
      },
    };
    annotationTextStyle = (source?: Dynamic): Dynamic => {
      let value: Dynamic =
        PlatformFileContentNoteTitle1Config[source.kind ?? "note"];
      return {
        size: source.size ?? value.size,
        kind: value.kind,
        bold: source.bold ?? value.bold,
        italic: source.italic ?? value.italic,
        color: source.color ?? "default",
        fill: value.kind === "note" ? (source.fill ?? "default") : "default",
      };
    };
    PlatformFileContentHas = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      for (let value of options as Dynamic) {
        let value2: Dynamic = context.has(value.id)
          ? input.find((input2?: Dynamic): Dynamic => input2.id === value.id)
          : undefined;
        if (
          value2 &&
          !isShapeAnnotation(value2) &&
          !isShapeAnnotation(value) &&
          value2.kind === value.kind &&
          (value2.maxW !== value.maxW || value2.maxH !== value.maxH)
        )
          return [value2, value];
      }
      return null;
    };
    PlatformFileContentMax = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
    ): Dynamic =>
      input
        ? options === undefined
          ? 1 / 0
          : Math.max(
              options,
              Math.ceil(
                (PlatformFileContentLh(1, value) *
                  Math.min(PlatformFileContentConstant_14, value)) /
                  value,
              ),
            )
        : Math.max(
            options ?? PlatformFileContentMax_2(context, value),
            PlatformFileContentLh(1, value),
          );
    PlatformFileContentKind = (source?: Dynamic): Dynamic =>
      PlatformFileContentMax(
        source.kind === "title1",
        source.maxH,
        source.w,
        annotationTextStyle(source).size,
      );
    PlatformFileContentMaxW = (input?: Dynamic): Dynamic =>
      input.maxW ?? PlatformFileContentConstant_11;
    PlatformFileContentHandler = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
          typeof input2 == "number" && Number.isFinite(input2)
            ? Math.round(
                PlatformFileContentMin_2(
                  input2,
                  PlatformFileContentConstant_12,
                  PlatformFileContentConstant_13,
                ),
              )
            : undefined,
        [items, items2]: Dynamic = [
          input === "title1" ? callback(options) : undefined,
          callback(context),
        ];
      return {
        ...(items !== undefined
          ? {
              maxW: items,
            }
          : {}),
        ...(items2 !== undefined
          ? {
              maxH: items2,
            }
          : {}),
      };
    };
    PlatformFileContentKind_2 = (source?: Dynamic): Dynamic => {
      let value: Dynamic = PlatformFileContentNoteTitle1Config[source.kind];
      return {
        ...(source.kind === "title1"
          ? {
              kind: "title1",
            }
          : {}),
        ...(source.size !== value.size
          ? {
              size: source.size,
            }
          : {}),
        ...(source.bold !== value.bold
          ? {
              bold: source.bold,
            }
          : {}),
        ...(source.italic !== value.italic
          ? {
              italic: source.italic,
            }
          : {}),
        ...(source.color !== "default"
          ? {
              color: source.color,
            }
          : {}),
        ...(source.kind === "note" && source.fill !== "default"
          ? {
              fill: source.fill,
            }
          : {}),
      };
    };
    validCoverArtboard = (input?: Dynamic, options?: Dynamic): Dynamic =>
      typeof input == "string" &&
      options.some((input2?: Dynamic): Dynamic => input2.file === input)
        ? input
        : undefined;
    artboardNameWithoutExtension = (input?: Dynamic): Dynamic =>
      (input.split("/").pop() ?? input).replace(/\.dc\.html$/, "");
    PlatformFileContentConstant_5 = 800;
    PlatformFileContentConstant_6 = 600;
    PlatformFileContentConstant_7 = 80;
    PlatformFileContentConstant_8 = 240;
    PlatformFileContentConstant_9 = 120;
    PlatformFileContentConstant_10 = 2e3;
    PlatformFileContentConstant_11 = 2e3;
    PlatformFileContentConstant_12 = 24;
    PlatformFileContentConstant_13 = 8e3;
    PlatformFileContentConstant_14 = 24;
    PlatformFileContentMin = (input?: Dynamic): Dynamic => ({
      lh: Math.min(1.45, Math.max(1.1, 1.45 - (input - 14) * 0.006)),
      px: Math.round(12 + (input - 14) * 0.2),
      py: Math.round(10 + (input - 14) * 0.11),
      ls: input >= 64 ? "-0.02em" : input >= 36 ? "-0.01em" : undefined,
    });
    PlatformFileContentLh = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let value: Dynamic = PlatformFileContentMin(options);
      return Math.round(input * options * value.lh) + 2 * value.py;
    };
    PlatformFileContentMax_2 = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Math.max(Math.round((input * 4) / 3), PlatformFileContentLh(6, options));
    PlatformFileContentMatch = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let length: Dynamic = (
          input.match(
            /[\u1100-\u11FF\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/g,
          ) ?? []
        ).length,
        length2: Dynamic = (input.match(/[A-Z]/g) ?? []).length;
      return Math.ceil(
        (length +
          length2 * 0.75 +
          ([...input].length - length - length2) * 0.55) *
          options,
      );
    };
    PlatformFileContentL = (input?: Dynamic, options?: Dynamic): Dynamic =>
      options < PlatformFileContentSMLConfig.l
        ? PlatformFileContentConstant_8
        : Math.min(
            PlatformFileContentConstant_10,
            Math.max(
              PlatformFileContentConstant_8,
              input
                .split(
                  `
`,
                )
                .reduce(
                  (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                    Math.max(
                      input2,
                      PlatformFileContentMatch(options2, options),
                    ),
                  0,
                ) + options,
            ),
          );
    PlatformFileContentTest = (input?: Dynamic): Dynamic =>
      typeof input == "string" &&
      /^((title|heading|header)\d*|h[1-6])$/i.test(input);
    PlatformFileContentLimit_4 = 5e3;
    PlatformFileContentLimit_5 = 200;
    PlatformFileContentConstant_15 = 40;
    PlatformFileContentConstant_16 = 120;
    PlatformFileContentConstant_17 = 8;
    PlatformFileContentLimit_6 = 8e3;
    PlatformFileContentResolvedValue_3 = PlatformFileContentLimit_6 / 2;
    PlatformFileContentConstant_18 = 1e6;
    PlatformFileContentRectOvalLineConfig = {
      rect: [120, 120],
      oval: [96, 96],
      line: [160, 0],
      arrow: [160, 0],
      pen: [2, 2],
      image: [320, 240],
    };
    PlatformFileContentConstant_19 = 2;
    PlatformFileContentConstant_20 = 16;
    PlatformFileContentTest_2 = (input?: Dynamic): Dynamic =>
      typeof input == "string" &&
      (/^\/?_blob\/[0-9a-f]{32}$/.test(input) ||
        /^\.\/[^\/\\:%?#"'\u0000-\u001f]{1,200}\.(png|jpe?g|gif|webp|svg|avif)$/i.test(
          input,
        ) ||
        /^blob:https?:\/\/[A-Za-z0-9.:-]{1,80}\/[0-9a-f-]{36}$/.test(input))
        ? input
        : null;
    PlatformFileContentTest_3 = (input?: Dynamic): Dynamic =>
      typeof input == "string" &&
      (/^\/?_blob\/[0-9a-f]{32}$/.test(input) ||
        /^blob:https?:\/\/[A-Za-z0-9.:-]{1,80}\/[0-9a-f-]{36}$/.test(input))
        ? input
        : null;
    PlatformFileContentLimit_7 = 24e3;
    PlatformFileContentTrim_2 = (items?: Dynamic): Dynamic => {
      if (typeof items != "string" || items.length > PlatformFileContentLimit_7)
        return null;
      let value: Dynamic = items.trim();
      return /^M ?\d+(\.\d+)?[ ,]\d+(\.\d+)?( ?([ML] ?\d+(\.\d+)?[ ,]\d+(\.\d+)?|C ?\d+(\.\d+)?([ ,]\d+(\.\d+)?){5}))+$/.test(
        value,
      ) &&
        (value.match(/\d+(\.\d+)?/g) ?? []).every(
          (input?: Dynamic): Dynamic =>
            Number(input) <= PlatformFileContentLimit_6,
        )
        ? value
        : null;
    };
    PlatformFileContentMin_2 = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => Math.min(context, Math.max(options, input));
    PlatformFileContentConstant_21 = 120;
    PlatformFileContentSlice = (input?: Dynamic): Dynamic => {
      if (typeof input != "string") return;
      let value: Dynamic = input
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, PlatformFileContentConstant_21);
      return value.length > 0 ? value : undefined;
    };
    PlatformFileContentSlice_2 = (input?: Dynamic): Dynamic =>
      typeof input != "string"
        ? ""
        : input
            .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
            .slice(0, PlatformFileContentLimit_4);
    PlatformFileContentTest_4 = (input?: Dynamic): Dynamic =>
      typeof input == "string" && /^[A-Za-z0-9_-]{1,40}$/.test(input)
        ? input
        : null;
    PlatformFileContentHandler_2 = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      typeof input == "string" &&
      Object.hasOwn(PlatformFileContentSMLConfig, input)
        ? PlatformFileContentSMLConfig[input]
        : typeof input != "number" || !Number.isFinite(input)
          ? options
          : Math.round(
              PlatformFileContentMin_2(
                input,
                PlatformFileContentConstant_3,
                PlatformFileContentConstant_4,
              ),
            );
    PlatformFileContentIncludes_2 = (color?: Dynamic): Dynamic =>
      typeof color == "string" &&
      PlatformFileContentGrayRedOrangeValues.includes(color)
        ? color
        : "default";
    PlatformFileContentIncludes_3 = (input?: Dynamic): Dynamic =>
      typeof input == "string" &&
      PlatformFileContentGrayRedOrangeValuesAlias.includes(input)
        ? input
        : "default";
    PlatformFileContentHandler_3 = (input?: Dynamic): Dynamic =>
      input === "rect" ||
      input === "oval" ||
      input === "line" ||
      input === "arrow" ||
      input === "pen" ||
      input === "image"
        ? input
        : null;
    normalizeDesignLaunch = (
      input?: Dynamic,
      options?: Dynamic,
      items?: Dynamic,
    ): Dynamic => {
      if (input === null || typeof input != "object") return;
      let view: Dynamic = input.view;
      if (view === "canvas") {
        let page: Dynamic = input.page;
        return typeof page == "string" &&
          items !== undefined &&
          items.length > 1 &&
          items.some((input2?: Dynamic): Dynamic => input2.id === page)
          ? {
              view: "canvas",
              page: page,
            }
          : {
              view: "canvas",
            };
      }
      if (view === "focused") {
        let file: Dynamic = input.file;
        if (
          typeof file == "string" &&
          options.some((input2?: Dynamic): Dynamic => input2.file === file)
        )
          return {
            view: "focused",
            file: file,
          };
      }
    };
    PlatformFileContentScriptDataPropsPattern =
      /<script\b(?:\s+(?!data-props\b)[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*\s+data-props\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
    artboardDisplayName = (artboard?: Dynamic): Dynamic =>
      artboard.title ?? artboard.file.replace(/\.dc\.html$/, "");
    annotationKindCategory = (source?: Dynamic): Dynamic =>
      source.kind === undefined || source.kind === "title1"
        ? "note"
        : source.kind === "image"
          ? "image"
          : "shape";
    DesignValue = "design";
    MetaValue = "meta";
    PlatformFileContentResolvedValue_4 = DesignValue + "/" + MetaValue;
    SourceValue = "source";
    PlatformFileContentResolvedValue_5 = DesignValue + "/" + SourceValue;
    BoardsValue = "boards";
    FilesValue = "files";
    NotesValue = "notes";
    PlatformFileContentResolvedValue_6 = 240 * 1024;
    PlatformFileContentResolvedValue_7 = 180 * 1024;
    PlatformFileContentResolvedValue_8 = 2 * 1024 * 1024;
    PlatformFileContentResolvedValue_9 =
      PlatformFileContentResolvedValue_6 - 2048;
    PlatformFileContentWebpAvifPattern =
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
    PlatformFileContentNodeModulesPattern =
      /(^|\/)(node_modules\/.*|(package(-lock)?|npm-shrinkwrap|composer|bower|cypress|jasmine|cdk|railway|claudia|cloudbuild|renovate|biome|app|nodemon|turbo|vercel|now|firebase|nx|project|workspace|angular|lerna|rush)\.json|wrangler\.jsonc?|(ts|js)config(\.[^/]*)?\.json|deno\.jsonc?|[^/]*\.(config|conf|workspace|mix)(\.[^/]*)?\.([cm]?[jt]sx?|json)|(gulp|grunt|jake|danger|plop|broc)file(\.[^/]*)?\.[cm]?[jt]sx?|(gatsby-(config|node|ssr|browser)|ember-cli-build|(brunch|truffle|bs|workbox|sw-precache|medusa|migrate-mongo)-config|truffle|knexfile|testem|cucumber|wallaby|serverless|ormconfig|electron-builder|nightwatch|newrelic|lighthouserc|codegen|setup(Tests|Proxy))(\.[^/]*)?\.([cm]?[jt]sx?|json)|((test|tests|spec|cypress|__tests__|__mocks__)\/.*|([^/]*[._-])?(test|spec)+|(test|spec)[._-][^/]*|[^/]*\.(cy|stories))\.[cm]?[jt]sx?)$/i;
    PlatformFileContentJsonPattern = /\.(css|m?js|jsx|tsx|json)$/i;
    PlatformFileContentLimit_8 = 300;
    PlatformFileContentAZaZAZaZPattern =
      /^[A-Za-z0-9_](?:[A-Za-z0-9 ._-]*[A-Za-z0-9_-])?$/;
    PlatformFileContentPattern_3 =
      /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
    ProjectValue = "project/";
    PlatformFileContentPattern_4 = /\.d\.ts$/i;
    PlatformFileContentResolvedValue_10 = 2 * 1024 * 1024;
    PlatformFileContentAZaZPattern = /[A-Za-z0-9_.-]/;
    PlatformFileContentTextEncoder = new TextEncoder();
    PlatformFileContentXYWValues = [
      "x",
      "y",
      "w",
      "h",
      "title",
      "expand",
      "print",
      "paper",
      "page",
      "is_interactive",
      "frameless",
      "guides",
      "radius",
    ];
    ClaudeDesignValue = "claude-design";
    PlatformFileContentLimit_9 = 2048;
    PlatformFileContentAZaZPattern_2 = /^[A-Za-z0-9_-]{1,64}$/;
    DesignPValue = "/design/p/";
    PlatformFileContentPattern_5 =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
    PlatformFileContentFilesValue = PlatformFileContentFilesBytesConfig.files;
    PlatformFileContentResolvedValue_11 = 2 * 1024 * 1024;
    PlatformFileContentLimit_10 = 300;
    PlatformFileContentTextEncoder_2 = new TextEncoder();
    PlatformFileContentTextEncoder_3 = new TextEncoder();
    FileValue = "file/";
    PlatformFileContentOverPerFilePattern =
      /over the (\d+(?:\.\d+)?) MiB per-file cap — (.*)$/;
    PlatformFileContentHandler_4 = (path?: Dynamic): Dynamic => `file/${path}`;
    PlatformFileContentAlias = null;
    AppifactValue = "appifact/";
    PlatformFileContentBeforeWriteVersionOfState = null;
    PlatformFileContentController = class extends Error {
      constructor(input: Dynamic) {
        super(`file not found: ${input}`);
      }
    };
    PlatformFileContentCache_2 = new Map();
    PlatformFileContentWebpAvifPattern_2 =
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
    projectFilesystem = {
      async readdir(input: Dynamic): Promise<Dynamic> {
        let value: Dynamic = stripAppifactPathPrefix(input),
          value2: Dynamic = PlatformFileContentHandler_4(
            value ? `${value}/` : "",
          );
        return (await getKvClient().list(value2)).map(
          (input2?: Dynamic): Dynamic => ({
            name: input2.slice(value2.length),
            isFile: true,
          }),
        );
      },
      async readFile(input: Dynamic): Promise<Dynamic> {
        let value: Dynamic = await getKvClient().get(
          PlatformFileContentHandler_4(stripAppifactPathPrefix(input)),
        );
        if (value == null) throw new PlatformFileContentController(input);
        return value;
      },
      async readFileWithVersion(input: Dynamic): Promise<Dynamic> {
        let value: Dynamic = await getKvClient().get(
          PlatformFileContentHandler_4(stripAppifactPathPrefix(input)),
        );
        if (value == null) throw new PlatformFileContentController(input);
        return {
          content: value,
          version: PlatformFileContentBeforeWriteVersionOfState?.versionOf(
            stripAppifactPathPrefix(input),
          ),
          isBase64: false,
        };
      },
      async writeFile(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Promise<Dynamic> {
        let value: Dynamic = stripAppifactPathPrefix(input);
        if (context === "base64") {
          await getKvClient().set(PlatformFileContentHandler_4(value), options);
          let value4: Dynamic = imageFileMimeType(value);
          registerAssetUrl(value, `data:${value4};base64,${options}`);
          return;
        }
        let value2: Dynamic =
          PlatformFileContentBeforeWriteVersionOfState === null
            ? "write"
            : PlatformFileContentBeforeWriteVersionOfState.beforeWrite(
                value,
                options,
                undefined,
              );
        if (value2 === "skip") return;
        let value3: Dynamic =
          typeof value2 == "object" ? value2.content : options;
        await getKvClient().set(PlatformFileContentHandler_4(value), value3);
        await PlatformFileContentBeforeWriteVersionOfState?.afterWrite(
          value,
          value3,
          false,
        );
      },
      async writeFileVersioned(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Promise<Dynamic> {
        if (
          PlatformFileContentBeforeWriteVersionOfState === null ||
          context.encoding === "base64"
        ) {
          await projectFilesystem.writeFile(input, options, context.encoding);
          return {
            version: undefined,
          };
        }
        let value: Dynamic = stripAppifactPathPrefix(input),
          value2: Dynamic =
            PlatformFileContentBeforeWriteVersionOfState.beforeWrite(
              value,
              options,
              context.baseline,
            );
        if (value2 === "skip")
          return {
            version:
              PlatformFileContentBeforeWriteVersionOfState.versionOf(value),
          };
        let value3: Dynamic =
          typeof value2 == "object" ? value2.content : options;
        await getKvClient().set(PlatformFileContentHandler_4(value), value3);
        return {
          version:
            await PlatformFileContentBeforeWriteVersionOfState.afterWrite(
              value,
              value3,
              true,
            ),
        };
      },
    };
    PreviewGenerationGate = class {
      gen: Dynamic = 0;
      mountedGen: Dynamic = 0;
      consumedGen: Dynamic = 0;
      port: Dynamic = null;
      latchedReason: Dynamic = null;
      helloWaiters: Dynamic = [];
      hostWillLoad(): Dynamic {
        this.gen += 1;
        return this.gen;
      }
      generationMounted(input: Dynamic): Dynamic {
        input === this.gen &&
          ((this.mountedGen = input),
          (this.port = null),
          (this.latchedReason = null),
          this.settleHelloWaiters(null));
      }
      frameRetired(): Dynamic {
        this.gen += 1;
        this.port = null;
        this.settleHelloWaiters(null);
      }
      helloReceived(input: Dynamic): Dynamic {
        return this.latchedReason != null || this.port != null
          ? "rejected"
          : ((this.port = input), this.settleHelloWaiters(input), "accepted");
      }
      waitForHello(input: Dynamic = 1500): Dynamic {
        return this.port != null
          ? Promise.resolve(this.port)
          : new Promise((input2?: Dynamic): Dynamic => {
              let callback: Dynamic = (input3?: Dynamic): Dynamic => {
                  clearTimeout(value);
                  input2(input3);
                },
                value: Dynamic = setTimeout((): Dynamic => {
                  let value2: Dynamic = this.helloWaiters.indexOf(callback);
                  value2 >= 0 && this.helloWaiters.splice(value2, 1);
                  input2(this.port);
                }, input);
              this.helloWaiters.push(callback);
            });
      }
      settleHelloWaiters(input: Dynamic): Dynamic {
        let value: Dynamic = this.helloWaiters.splice(0);
        for (let value2 of value as Dynamic) value2(input);
      }
      frameLoaded(): Dynamic {
        return this.latchedReason == null && this.consumedGen < this.mountedGen
          ? ((this.consumedGen = this.mountedGen),
            {
              kind: "first",
              gen: this.mountedGen,
            })
          : (this.latch("the preview document navigated itself"),
            {
              kind: "foreign",
            });
      }
      verdict(input: Dynamic, options: Dynamic): Dynamic {
        input !== this.gen ||
          input !== this.mountedGen ||
          (options !== "alive" &&
            this.latch(
              "the preview stopped answering the editor (replaced by a navigation, or unresponsive for too long)",
            ));
      }
      get helloPort(): Dynamic {
        return this.port;
      }
      get mountedGeneration(): Dynamic {
        return this.mountedGen;
      }
      get blocked(): Dynamic {
        return this.latchedReason;
      }
      latch(input: Dynamic): Dynamic {
        this.latchedReason == null && (this.latchedReason = input);
      }
    };
    defaultPreviewGenerationGate = new PreviewGenerationGate();
    PlatformFileContentElementCache = new WeakMap();
    PlatformFileContentFreezeValue = Object.freeze([]);
    PlatformFileContentFreezeValueAlias = PlatformFileContentFreezeValue;
    PlatformFileContentSubscribers_4 = new Set();
    roomPeerSubscriptionStarted = false;
    PlatformFileContentCurrentState = null;
    roomPeersStore = {
      getSnapshot: (): Dynamic => PlatformFileContentFreezeValueAlias,
      subscribe(input: Dynamic): Dynamic {
        PlatformFileContentSubscribers_4.add(input);
        subscribeRoomPeers();
        return (): Dynamic => PlatformFileContentSubscribers_4.delete(input);
      },
    };
    PlatformFileContentAZaZPattern_3 = /^(?:[A-Za-z0-9_-]{1,80}\/){1,4}$/;
    PlatformFileContentAZaZPattern_4 = /^[A-Za-z0-9_-]{1,80}$/;
    PlatformFileContentSubscribers_5 = new Set();
    embeddedWritesTracked = false;
    embeddedEditorFrozen = false;
    embeddedFreezeRequested = false;
    embeddedWriteFailed = false;
    PlatformFileContentAlias_3 = null;
    PlatformFileContentAlias_4 = null;
    PlatformFileContentCurrentState_2 = null;
    PlatformFileContentDelayMs = 60;
    PlatformFileContentConstant_22 = 6e4;
    PlatformFileContentConstant_23 = 500;
  };
}
