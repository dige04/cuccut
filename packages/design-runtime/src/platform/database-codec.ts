import type { DataRecord } from "../contracts/storage";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPlatformDatabaseCodec(
  runtime: RuntimeBindings,
): () => void {
  var DESIGN_SYSTEM_DOCUMENT_PATH: Dynamic;
  var DESIGN_CONVERSION_LOCK_PATH: Dynamic;
  var optionalString: Dynamic;
  var documentPathBasename: Dynamic;
  var isDirectCollectionDocument: Dynamic;
  var isReservedConversionFile: Dynamic;
  var serializeConvertedArtboard: Dynamic;
  var readDatabaseBoardOrder: Dynamic;
  async function readDatabaseArtboardHtml(
    record?: Dynamic,
    store?: Dynamic,
  ): Promise<Dynamic> {
    let htmlRef: Dynamic = optionalString(record.htmlRef);
    if (htmlRef === undefined) return optionalString(record.html);
    if (!(0, runtime.isBlobAssetUrl)(htmlRef)) return;
    let value: Dynamic = JSON.parse(await store.readBlob(htmlRef));
    if (typeof value?.html != "string")
      throw new Error("the upload an artboard points at is not an artboard");
    return value.html;
  }
  function databaseArtboardFilePath(record?: Dynamic): Dynamic {
    let filePath: Dynamic = record.data.path;
    return (0, runtime.isSafeProjectPath)(filePath) &&
      (0, runtime.isArtboardFile)(filePath) &&
      documentPathBasename(record.path) ===
        (0, runtime.encodeStorePathSegment)(filePath)
      ? filePath
      : undefined;
  }
  async function readDatabaseFileEntry(
    record?: Dynamic,
    store?: Dynamic,
  ): Promise<Dynamic> {
    let data: Dynamic = record.data,
      path: Dynamic = data.path,
      inlineData: Dynamic = optionalString(data.data),
      dataRef: Dynamic = optionalString(data.dataRef);
    if (
      inlineData === undefined &&
      data.kind === "text" &&
      dataRef !== undefined &&
      (0, runtime.isBlobAssetUrl)(dataRef) &&
      (((0, runtime.isProjectTextFilePath)(path) &&
        /\.(css|m?js)$/i.test(path)) ||
        (0, runtime.isTypeDeclarationPath)(path)) &&
      documentPathBasename(record.path) ===
        (0, runtime.encodeStorePathSegment)(path)
    )
      return {
        path: path,
        data: await store.readBlob(dataRef),
      };
    if (
      !(
        !(0, runtime.isSafeProjectPath)(path) ||
        (0, runtime.isArtboardFile)(path) ||
        path === runtime.canvasMetadataFile ||
        isReservedConversionFile(path) ||
        !(0, runtime.isSupportedProjectAsset)(path) ||
        documentPathBasename(record.path) !==
          (0, runtime.encodeStorePathSegment)(path) ||
        inlineData === undefined
      )
    )
      return {
        path: path,
        data: inlineData,
      };
  }
  function readDatabaseAnnotation(record?: Dynamic): Dynamic {
    let data: Dynamic = record.data;
    if (
      typeof data.x != "number" ||
      typeof data.y != "number" ||
      (0, runtime.isPrototypeProperty)(documentPathBasename(record.path))
    )
      return;
    let callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
      typeof data[input] == "number" && typeof data[options] == "number";
    return (
      data.kind === "rect" || data.kind === "oval"
        ? callback("w", "h")
        : data.kind === "line" || data.kind === "arrow"
          ? callback("x2", "y2")
          : data.kind === "pen"
            ? callback("w", "h") && typeof data.d == "string"
            : data.kind === "image"
              ? callback("w", "h") && typeof data.src == "string"
              : typeof data.text == "string"
    )
      ? {
          ...data,
          id: documentPathBasename(record.path),
        }
      : undefined;
  }
  function buildConvertedDesignIndex(
    metadata?: Dynamic,
    boards?: Dynamic,
    order?: Dynamic,
    annotations?: Dynamic,
    title?: Dynamic,
  ): Dynamic {
    let manifestText: Dynamic = JSON.stringify({
      artboards: order.map(
        (input?: Dynamic): Dynamic =>
          serializeConvertedArtboard(input, boards.get(input)),
      ),
      annotations: annotations,
      ...(metadata?.launch !== undefined
        ? {
            launch: metadata.launch,
          }
        : {}),
      ...(metadata?.pages !== undefined
        ? {
            pages: metadata.pages,
          }
        : {}),
      ...(metadata?.cover !== undefined
        ? {
            cover: metadata.cover,
          }
        : {}),
      ...(metadata?.migrated === true
        ? {
            migrated: true,
          }
        : {}),
    });
    return (0, runtime.serializeCanvasMetadata)(
      (0, runtime.parseCanvasMetadata)(manifestText, title),
    );
  }
  function copyDesignSourceMetadata(
    index?: Dynamic,
    records?: Dynamic,
  ): Dynamic {
    let sourceMetadata: Dynamic = (0, runtime.parseDesignSource)(
      records.get(runtime.PlatformFileContentResolvedValue_5)?.data,
    );
    sourceMetadata !== undefined &&
      (index[runtime.INDEX_SOURCE_KEY] = (0, runtime.cloneIndexValue)(
        sourceMetadata,
      ));
    let tokens2: Dynamic = records.get(DESIGN_SYSTEM_DOCUMENT_PATH)?.data;
    tokens2 !== undefined &&
      (index[runtime.INDEX_DESIGN_SYSTEM_TOKENS_KEY] = (0,
      runtime.cloneIndexValue)(tokens2));
  }
  function annotationMatchesDatabase(
    annotation?: Dynamic,
    record?: Dynamic,
  ): Dynamic {
    let decoded: Dynamic = readDatabaseAnnotation(record);
    return annotation === undefined || decoded === undefined
      ? false
      : Object.entries(encodeDatabaseAnnotation(decoded)).every(
          ([input, input2]: Dynamic): Dynamic =>
            Object.hasOwn(annotation, input) &&
            (0, runtime.equalIndexValue)(annotation[input], input2),
        );
  }
  function sourceMetadataMatchesDatabase(
    index?: Dynamic,
    record?: Dynamic,
  ): Dynamic {
    let metadata: Dynamic =
      index[
        record.path === runtime.PlatformFileContentResolvedValue_5
          ? runtime.INDEX_SOURCE_KEY
          : runtime.INDEX_DESIGN_SYSTEM_TOKENS_KEY
      ];
    return (
      metadata !== undefined &&
      (0, runtime.equalIndexValue)(metadata, record.data)
    );
  }
  function createDesignDatabaseCodec(options?: Dynamic): Dynamic {
    async function composeDatabaseSnapshot(input?: Dynamic): Promise<Dynamic> {
      let value2: Dynamic = input.get(
          runtime.PlatformFileContentResolvedValue_4,
        )?.data,
        entries: Dynamic = new Map(),
        state: Dynamic = {},
        entries2: Dynamic = new Map(),
        items: Dynamic = [],
        items2: Dynamic = [];
      for (let value8 of input.values() as Dynamic)
        if (isDirectCollectionDocument(value8.path, runtime.BoardsValue)) {
          let value9: Dynamic = databaseArtboardFilePath(value8);
          value9 !== undefined && entries.set(value9, value8.data);
        } else if (
          isDirectCollectionDocument(value8.path, runtime.NotesValue)
        ) {
          let value9: Dynamic = readDatabaseAnnotation(value8);
          value9 !== undefined &&
            (items.push(value9), items2.push(value8.path));
        }
      let value3: Dynamic = readDatabaseBoardOrder(
        value2,
        (input2?: Dynamic): Dynamic => entries.has(input2),
      );
      for (let value8 of value3 as Dynamic) {
        let value9: Dynamic = await readDatabaseArtboardHtml(
          entries.get(value8),
          options,
        );
        value9 !== undefined &&
          ((state[value8] = value9),
          entries2.set((0, runtime.toProjectContentPath)(value8), [
            runtime.BoardsValue +
              "/" +
              (0, runtime.encodeStorePathSegment)(value8),
          ]));
      }
      let value4: Dynamic = value3.filter(
        (input2?: Dynamic): Dynamic => state[input2] !== undefined,
      );
      for (let value8 of input.values() as Dynamic) {
        if (!isDirectCollectionDocument(value8.path, runtime.FilesValue))
          continue;
        let value9: Dynamic = await readDatabaseFileEntry(value8, options);
        value9 === undefined ||
          state[value9.path] !== undefined ||
          ((state[value9.path] = value9.data),
          entries2.set((0, runtime.toProjectContentPath)(value9.path), [
            value8.path,
          ]));
      }
      let value5: Dynamic = optionalString(value2?.title) ?? "",
        value6: Dynamic = (0, runtime.createDesignIndexFromFiles)(
          value5,
          buildConvertedDesignIndex(value2, entries, value4, items, state),
          state,
        );
      copyDesignSourceMetadata(value6, input);
      entries2.set(runtime.projectMetadataPaths.design, [
        runtime.PlatformFileContentResolvedValue_4,
        ...value4.map(
          (input2?: Dynamic): Dynamic =>
            runtime.BoardsValue +
            "/" +
            (0, runtime.encodeStorePathSegment)(input2),
        ),
        ...items2,
        ...(input.has(runtime.PlatformFileContentResolvedValue_5)
          ? [runtime.PlatformFileContentResolvedValue_5]
          : []),
        ...(input.has(DESIGN_SYSTEM_DOCUMENT_PATH)
          ? [DESIGN_SYSTEM_DOCUMENT_PATH]
          : []),
      ]);
      let entries3: Dynamic = new Map(),
        value7: Dynamic = [
          ...Object.keys(state).filter(
            (input2?: Dynamic): Dynamic =>
              !(0, runtime.canSaveDesignFile)(input2),
          ),
          ...[...input.values()]
            .filter(
              (input2?: Dynamic): Dynamic =>
                isDirectCollectionDocument(input2.path, runtime.FilesValue) &&
                isReservedConversionFile(input2.data.path),
            )
            .map((input2?: Dynamic): Dynamic => input2.data.path),
        ].sort();
      value7.length > 0 && (value6[runtime.INDEX_LEFT_OUT_KEY] = value7);
      for (let [value8, value9] of Object.entries(state) as Dynamic)
        (0, runtime.canSaveDesignFile)(value8) &&
          entries3.set(
            (0, runtime.toProjectContentPath)(value8),
            (0, runtime.encodeDesignPortFile)(value8, value9),
          );
      let items3: Dynamic = [
        ...items2.filter(
          (input2?: Dynamic): Dynamic =>
            Object.hasOwn(value6.notes, documentPathBasename(input2)) &&
            annotationMatchesDatabase(
              value6.notes[documentPathBasename(input2)],
              input.get(input2),
            ),
        ),
        ...[
          runtime.PlatformFileContentResolvedValue_5,
          DESIGN_SYSTEM_DOCUMENT_PATH,
        ].filter(
          (input2?: Dynamic): Dynamic =>
            input.has(input2) &&
            sourceMetadataMatchesDatabase(value6, input.get(input2)),
        ),
      ];
      return {
        files: entries3,
        index: value6,
        sources: entries2,
        indexSources: items3,
      };
    }
    async function value(input?: Dynamic): Promise<Dynamic> {
      let value2: Dynamic = (0, runtime.normalizeDesignIndex)(
          (0, runtime.cloneIndexValue)(input.index),
        ),
        entries: Dynamic = new Map(),
        entries2: Dynamic = new Map(),
        items: Dynamic = [],
        value3: Dynamic = input.snapshot.get(
          runtime.PlatformFileContentResolvedValue_4,
        )?.data;
      if (value3 === undefined)
        return {
          files: entries,
          index: value2,
          sources: entries2,
        };
      let entries3: Dynamic = new Map();
      for (let value6 of input.snapshot.values() as Dynamic)
        if (isDirectCollectionDocument(value6.path, runtime.BoardsValue)) {
          let value7: Dynamic = databaseArtboardFilePath(value6);
          value7 !== undefined && entries3.set(value7, value6);
        }
      let items2: Dynamic = [],
        callback: Dynamic = async (input2?: Dynamic): Promise<Dynamic> => {
          let value6: Dynamic = await input.readFileState(input2);
          return value6.state === "text"
            ? value6.text
            : value6.state === "absent"
              ? null
              : "unreadable";
        },
        value4: Dynamic = await callback(runtime.readPortVersion);
      if (value4 === "unreadable")
        return {
          files: entries,
          index: value2,
          sources: entries2,
          unfolded: [
            ...input.changed.map((input2?: Dynamic): Dynamic => input2.path),
            ...input.removed,
          ],
        };
      let value5: Dynamic =
          value4 === null
            ? null
            : (0, runtime.parsePublishedIndexMetadata)(value4),
        callback2: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          options2 === null ||
          value5?.files[input2]?.sha256 ===
            (0, runtime.sha256Fallback)(
              (0, runtime.PlatformSha256Encode)(options2),
            ),
        callback3: Dynamic = (input2?: Dynamic): Dynamic =>
          value5?.files[(0, runtime.toProjectContentPath)(input2)] !==
          undefined,
        callback4: Dynamic = (input2?: Dynamic, items3?: Dynamic): Dynamic =>
          items3 == null ||
          items3 === "" ||
          (Array.isArray(items3) && items3.length === 0) ||
          (typeof items3 == "object" && Object.keys(items3).length === 0) ||
          (input2 === "title" && items3 === options.defaultTitle),
        callback5: Dynamic = async (
          input2?: Dynamic,
          options2?: Dynamic,
          context?: Dynamic,
        ): Promise<Dynamic> => {
          let entry: Dynamic = input.recorded.get(input2.path);
          if (entry === undefined) return true;
          let value6: Dynamic = entry[options2];
          return (await (0, runtime.hashCanonicalIndex)(
            input2.data[options2],
          )) === value6
            ? false
            : value6 === undefined
              ? callback4(options2, context)
              : (await (0, runtime.hashCanonicalIndex)(context)) === value6;
        },
        callback6: Dynamic = async (input2?: Dynamic): Promise<Dynamic> => {
          let entry: Dynamic = entries3.get(input2);
          if (entry === undefined) return;
          let value6: Dynamic = !(input2 in value2.boards);
          if (
            (value6 && callback3(input2)) ||
            (!value6 &&
              !callback3(input2) &&
              input.recorded.get(entry.path) === undefined)
          )
            return;
          let value7: Dynamic = value6
            ? null
            : await callback((0, runtime.toProjectContentPath)(input2));
          if (value7 === "unreadable") return void items2.push(entry.path);
          let entry2: Dynamic = input.recorded.get(entry.path),
            value8: Dynamic =
              entry2 === undefined ||
              (await (0, runtime.hashCanonicalIndex)(entry.data.html)) !==
                entry2.html ||
              (await (0, runtime.hashCanonicalIndex)(entry.data.htmlRef)) !==
                entry2.htmlRef;
          if (
            value6 ||
            (value8 &&
              callback2((0, runtime.toProjectContentPath)(input2), value7))
          ) {
            let value10: Dynamic = await readDatabaseArtboardHtml(
              entry.data,
              options,
            );
            value10 !== undefined &&
              value10 !== value7 &&
              (entries.set(
                (0, runtime.toProjectContentPath)(input2),
                (0, runtime.encodeDesignPortFile)(input2, value10),
              ),
              entries2.set((0, runtime.toProjectContentPath)(input2), [
                entry.path,
              ]));
          }
          let value9: Dynamic = (value2.boards[input2] ??= {});
          for (let value10 of runtime.PlatformFileContentXYWValues as Dynamic) {
            if (!value6 && !(await callback5(entry, value10, value9[value10])))
              continue;
            let value11: Dynamic = entry.data[value10];
            value11 == null
              ? delete value9[value10]
              : (value9[value10] = (0, runtime.cloneIndexValue)(value11));
          }
          value2.order.includes(input2) || value2.order.push(input2);
        },
        values: Dynamic = new Set(
          readDatabaseBoardOrder(
            value3,
            (input2?: Dynamic): Dynamic => entries3.has(input2),
          ),
        );
      for (let value6 of input.changed as Dynamic)
        if (value6.path === runtime.PlatformFileContentResolvedValue_4) {
          typeof value6.data.title == "string" &&
            (await callback5(value6, "title", value2.title)) &&
            (value2.title = value6.data.title);
          Array.isArray(value6.data.pages) &&
            (await callback5(value6, "pages", value2.pages)) &&
            (value2.pages = (0, runtime.cloneIndexValue)(value6.data.pages));
          typeof value6.data.launch == "object" &&
            value6.data.launch !== null &&
            (await callback5(value6, "launch", value2.launch)) &&
            (value2.launch = (0, runtime.cloneIndexValue)(value6.data.launch));
          (await callback5(value6, "cover", value2.cover)) &&
            (typeof value6.data.cover == "string"
              ? (value2.cover = value6.data.cover)
              : delete value2.cover);
          for (let value10 of values as Dynamic)
            value10 in value2.boards || (await callback6(value10));
          let value7: Dynamic = [...values].filter(
              (input2?: Dynamic): Dynamic => input2 in value2.boards,
            ),
            value8: Dynamic = value7.filter(
              (input2?: Dynamic): Dynamic =>
                !input.index.order.includes(input2) && !callback3(input2),
            ),
            value9: Dynamic = value2.order.filter(
              (input2?: Dynamic): Dynamic => !value8.includes(input2),
            );
          for (let value10 of value8 as Dynamic) {
            let value11: Dynamic = value7
              .slice(0, value7.indexOf(value10))
              .reverse()
              .find((input2?: Dynamic): Dynamic => value9.includes(input2));
            value9.splice(
              value11 === undefined ? 0 : value9.indexOf(value11) + 1,
              0,
              value10,
            );
          }
          value2.order = (0, runtime.orderedDesignMapKeys)(
            value9,
            value2.boards,
          );
        } else if (
          isDirectCollectionDocument(value6.path, runtime.BoardsValue)
        ) {
          let value7: Dynamic = databaseArtboardFilePath(value6);
          value7 !== undefined &&
            (values.has(value7) || value7 in value2.boards) &&
            (await callback6(value7));
        } else if (
          isDirectCollectionDocument(value6.path, runtime.FilesValue)
        ) {
          let value7: Dynamic = await readDatabaseFileEntry(value6, options);
          if (value7 === undefined) continue;
          let value8: Dynamic = await callback(
            (0, runtime.toProjectContentPath)(value7.path),
          );
          if (value8 === "unreadable") {
            items2.push(value6.path);
            continue;
          }
          (0, runtime.canSaveDesignFile)(value7.path) &&
            callback2((0, runtime.toProjectContentPath)(value7.path), value8) &&
            value7.data !== value8 &&
            (entries.set(
              (0, runtime.toProjectContentPath)(value7.path),
              (0, runtime.encodeDesignPortFile)(value7.path, value7.data),
            ),
            entries2.set((0, runtime.toProjectContentPath)(value7.path), [
              value6.path,
            ]));
        } else if (
          isDirectCollectionDocument(value6.path, runtime.NotesValue)
        ) {
          let value7: Dynamic = readDatabaseAnnotation(value6);
          if (value7 === undefined) continue;
          let value8: Dynamic = documentPathBasename(value6.path),
            value9: Dynamic = encodeDatabaseAnnotation(value7),
            value10: Dynamic = value2.notes[value8];
          if (
            value10 === undefined ||
            input.recorded.get(value6.path) === undefined
          ) {
            value2.notes[value8] = value9;
            Object.hasOwn(value2.notes, value8) && items.push(value6.path);
            continue;
          }
          for (let value11 of new Set([
            ...Object.keys(value9),
            ...Object.keys(value10),
          ]) as Dynamic)
            value11 !== "d1" &&
              (await callback5(
                value6,
                value11,
                value11 === "d" && typeof value10.d == "string"
                  ? String(value10.d) + String(value10.d1 ?? "")
                  : value10[value11],
              )) &&
              (value9[value11] === undefined
                ? (delete value10[value11],
                  value11 === "d" && delete value10.d1)
                : ((value10[value11] = value9[value11]),
                  value11 === "d" &&
                    (value9.d1 === undefined
                      ? delete value10.d1
                      : (value10.d1 = value9.d1))));
          Object.hasOwn(value2.notes, value8) &&
            annotationMatchesDatabase(value2.notes[value8], value6) &&
            items.push(value6.path);
        } else
          (value6.path === runtime.PlatformFileContentResolvedValue_5 ||
            value6.path === DESIGN_SYSTEM_DOCUMENT_PATH) &&
            (copyDesignSourceMetadata(value2, input.snapshot),
            sourceMetadataMatchesDatabase(value2, value6) &&
              items.push(value6.path));
      for (let value6 of input.removed as Dynamic)
        if (isDirectCollectionDocument(value6, runtime.NotesValue))
          delete value2.notes[documentPathBasename(value6)];
        else if (isDirectCollectionDocument(value6, runtime.BoardsValue)) {
          let value7: Dynamic = Object.keys(value2.boards).find(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.encodeStorePathSegment)(input2) ===
              documentPathBasename(value6),
          );
          if (value7 === undefined) continue;
          let value8: Dynamic = await callback(
            (0, runtime.toProjectContentPath)(value7),
          );
          if (value8 === "unreadable") {
            items2.push(value6);
            continue;
          }
          if (!callback2((0, runtime.toProjectContentPath)(value7), value8))
            continue;
          delete value2.boards[value7];
          value2.order = value2.order.filter(
            (input2?: Dynamic): Dynamic => input2 !== value7,
          );
          entries.set((0, runtime.toProjectContentPath)(value7), null);
        }
      return {
        files: entries,
        index: value2,
        sources: entries2,
        ...(items.length > 0
          ? {
              indexSources: items,
            }
          : {}),
        ...(items2.length > 0
          ? {
              unfolded: items2,
            }
          : {}),
      };
    }
    return {
      toTree: composeDatabaseSnapshot,
      serializeIndex: (input?: Dynamic): Dynamic =>
        (0, runtime.stringifyCanonicalIndex)(input),
      fold: value,
    };
  }
  function encodeDatabaseAnnotation(annotation?: Dynamic): Dynamic {
    let { id: id, d: path, ...properties }: Dynamic = annotation;
    return typeof path != "string"
      ? (0, runtime.cloneIndexValue)(properties)
      : {
          ...((0, runtime.cloneIndexValue)(properties) as DataRecord),
          d: path.slice(0, runtime.MAX_NOTE_INLINE_PATH_CHARS),
          ...(path.length > runtime.MAX_NOTE_INLINE_PATH_CHARS
            ? {
                d1: path.slice(runtime.MAX_NOTE_INLINE_PATH_CHARS),
              }
            : {}),
        };
  }
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_DOCUMENT_PATH",
    () => DESIGN_SYSTEM_DOCUMENT_PATH,
    (value) => {
      DESIGN_SYSTEM_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_CONVERSION_LOCK_PATH",
    () => DESIGN_CONVERSION_LOCK_PATH,
    (value) => {
      DESIGN_CONVERSION_LOCK_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "optionalString",
    () => optionalString,
    (value) => {
      optionalString = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentPathBasename",
    () => documentPathBasename,
    (value) => {
      documentPathBasename = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDirectCollectionDocument",
    () => isDirectCollectionDocument,
    (value) => {
      isDirectCollectionDocument = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readDatabaseArtboardHtml",
    () => readDatabaseArtboardHtml,
  );
  bindRuntimeValue(
    runtime,
    "databaseArtboardFilePath",
    () => databaseArtboardFilePath,
  );
  bindRuntimeValue(
    runtime,
    "isReservedConversionFile",
    () => isReservedConversionFile,
    (value) => {
      isReservedConversionFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readDatabaseFileEntry",
    () => readDatabaseFileEntry,
  );
  bindRuntimeValue(
    runtime,
    "readDatabaseAnnotation",
    () => readDatabaseAnnotation,
  );
  bindRuntimeValue(
    runtime,
    "serializeConvertedArtboard",
    () => serializeConvertedArtboard,
    (value) => {
      serializeConvertedArtboard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildConvertedDesignIndex",
    () => buildConvertedDesignIndex,
  );
  bindRuntimeValue(
    runtime,
    "readDatabaseBoardOrder",
    () => readDatabaseBoardOrder,
    (value) => {
      readDatabaseBoardOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "copyDesignSourceMetadata",
    () => copyDesignSourceMetadata,
  );
  bindRuntimeValue(
    runtime,
    "annotationMatchesDatabase",
    () => annotationMatchesDatabase,
  );
  bindRuntimeValue(
    runtime,
    "sourceMetadataMatchesDatabase",
    () => sourceMetadataMatchesDatabase,
  );
  bindRuntimeValue(
    runtime,
    "createDesignDatabaseCodec",
    () => createDesignDatabaseCodec,
  );
  bindRuntimeValue(
    runtime,
    "encodeDatabaseAnnotation",
    () => encodeDatabaseAnnotation,
  );
  return () => {
    DESIGN_SYSTEM_DOCUMENT_PATH =
      runtime.DesignValue + "/" + runtime.DesignSystemsKey;
    DESIGN_CONVERSION_LOCK_PATH = runtime.DesignValue + "/convert-lock";
    optionalString = (input?: Dynamic): Dynamic =>
      typeof input == "string" ? input : undefined;
    documentPathBasename = (input?: Dynamic): Dynamic =>
      input.slice(input.indexOf("/") + 1);
    isDirectCollectionDocument = (input?: Dynamic, items?: Dynamic): Dynamic =>
      input.startsWith(items + "/") && input.indexOf("/", items.length + 1) < 0;
    isReservedConversionFile = (input?: Dynamic): Dynamic =>
      typeof input == "string" &&
      input !== runtime.canvasMetadataFile &&
      (0, runtime.isReservedProjectPath)(
        "design",
        runtime.projectPathPrefix + input,
      );
    serializeConvertedArtboard = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let state: Dynamic = {
        file: input,
      };
      for (let value of runtime.PlatformFileContentXYWValues as Dynamic)
        options[value] !== undefined &&
          options[value] !== null &&
          (state[value] = options[value]);
      return state;
    };
    readDatabaseBoardOrder = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let items: Dynamic = [];
      if (Array.isArray(input?.boardOrder))
        for (let value of input.boardOrder as Dynamic)
          typeof value == "string" &&
            options(value) &&
            !items.includes(value) &&
            items.push(value);
      return items;
    };
  };
}
