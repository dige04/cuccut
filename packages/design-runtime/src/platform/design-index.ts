/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDesignIndex(
  runtime: RuntimeBindings,
): () => void {
  var CURRENT_DESIGN_INDEX_VERSION: Dynamic;
  var INDEX_SOURCE_KEY: Dynamic;
  var INDEX_DESIGN_SYSTEM_TOKENS_KEY: Dynamic;
  var INDEX_LEFT_OUT_KEY: Dynamic;
  var MAX_NOTE_INLINE_PATH_CHARS: Dynamic;
  var FILES_INDEX_MERGE_POLICY: Dynamic;
  var isPlainDesignIndexObject: Dynamic;
  var isPrototypeProperty: Dynamic;
  var equalDesignIndexJson: Dynamic;
  var createEmptyDesignIndex: Dynamic;
  var isNonemptyIndexAnnotation: Dynamic;
  var INDEX_ANNOTATION_PROPERTIES: Dynamic;
  function orderedDesignMapKeys(order?: Dynamic, records?: Dynamic): Dynamic {
    let keys: Dynamic = new Set();
    for (let value of order as Dynamic) value in records && keys.add(value);
    for (let value of Object.keys(records).sort() as Dynamic) keys.add(value);
    return [...keys];
  }
  function normalizeDesignIndex(value?: Dynamic): Dynamic {
    let input: Dynamic = isPlainDesignIndexObject(value) ? value : {},
      boards: Dynamic = {};
    if (isPlainDesignIndexObject(input.boards))
      for (let [value2, value3] of Object.entries(input.boards) as Dynamic)
        isPlainDesignIndexObject(value3) &&
          !isPrototypeProperty(value2) &&
          (boards[value2] = value3);
    let notes: Dynamic = {};
    if (isPlainDesignIndexObject(input.notes))
      for (let [value2, value3] of Object.entries(input.notes) as Dynamic)
        isPlainDesignIndexObject(value3) &&
          !isPrototypeProperty(value2) &&
          (notes[value2] = value3);
    let index: Dynamic = {
      ...input,
      v:
        typeof input.v == "number" && input.v >= CURRENT_DESIGN_INDEX_VERSION
          ? input.v
          : CURRENT_DESIGN_INDEX_VERSION,
      title: typeof input.title == "string" ? input.title : "",
      launch: isPlainDesignIndexObject(input.launch) ? input.launch : {},
      pages: Array.isArray(input.pages)
        ? input.pages.filter(
            (input2?: Dynamic): Dynamic =>
              isPlainDesignIndexObject(input2) && typeof input2.id == "string",
          )
        : [],
      boards: boards,
      order: Array.isArray(input.order)
        ? input.order.filter(
            (input2?: Dynamic): Dynamic => typeof input2 == "string",
          )
        : [],
      notes: notes,
      designSystems: Array.isArray(input.designSystems)
        ? input.designSystems
        : [],
      attachments: isPlainDesignIndexObject(input.attachments)
        ? input.attachments
        : {},
    };
    typeof input.cover != "string" && delete index.cover;
    input.migrated !== true && delete index.migrated;
    return index;
  }
  function serializeIndexArtboard(file?: Dynamic, board?: Dynamic): Dynamic {
    let result: Dynamic = {
      file: file,
    };
    for (let value of runtime.PlatformFileContentXYWValues as Dynamic)
      if (!(board[value] === undefined || board[value] === null))
        if (value === "guides")
          try {
            result.guides =
              typeof board.guides == "string"
                ? JSON.parse(board.guides)
                : board.guides;
          } catch {}
        else result[value] = board[value];
    return result;
  }
  function deserializeIndexAnnotation(id?: Dynamic, note?: Dynamic): Dynamic {
    let { d1: pathRemainder, ...properties }: Dynamic = note;
    return {
      ...properties,
      ...(typeof note.d == "string" && typeof pathRemainder == "string"
        ? {
            d: note.d + pathRemainder,
          }
        : {}),
      id: id,
    };
  }
  function buildDesignDocumentFromIndex(
    index?: Dynamic,
    files?: Dynamic,
  ): Dynamic {
    let manifestText: Dynamic = JSON.stringify({
      artboards: orderedDesignMapKeys(index.order, index.boards)
        .filter(
          (input?: Dynamic): Dynamic => !(0, runtime.isDesignSystemFile)(input),
        )
        .map(
          (input?: Dynamic): Dynamic =>
            serializeIndexArtboard(input, index.boards[input]),
        ),
      annotations: Object.keys(index.notes)
        .filter(
          (input?: Dynamic): Dynamic =>
            isNonemptyIndexAnnotation(index.notes[input]),
        )
        .map(
          (input?: Dynamic): Dynamic =>
            deserializeIndexAnnotation(input, index.notes[input]),
        ),
      ...(typeof index.launch.view == "string"
        ? {
            launch: index.launch,
          }
        : {}),
      ...(index.pages.length > 0
        ? {
            pages: index.pages,
          }
        : {}),
      ...(index.cover !== undefined
        ? {
            cover: index.cover,
          }
        : {}),
      ...(index.migrated === true
        ? {
            migrated: true,
          }
        : {}),
    });
    return (0, runtime.serializeCanvasMetadata)(
      (0, runtime.parseCanvasMetadata)(manifestText, files),
    );
  }
  function buildSelectedBoardsDocument(
    index?: Dynamic,
    files?: Dynamic,
  ): Dynamic {
    if (files.length === 0) return [];
    let manifestText: Dynamic = JSON.stringify({
      artboards: files.map(
        (input?: Dynamic): Dynamic =>
          serializeIndexArtboard(input, index.boards[input]),
      ),
      ...(index.pages.length > 0
        ? {
            pages: index.pages,
          }
        : {}),
    });
    return (0, runtime.parseCanvasMetadata)(
      manifestText,
      Object.fromEntries(files.map((input?: Dynamic): Dynamic => [input, ""])),
    ).artboards.filter((input?: Dynamic): Dynamic => input.frameless !== true);
  }
  function updateIndexProperty(
    object?: Dynamic,
    key?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    value === undefined
      ? key in object && delete object[key]
      : equalDesignIndexJson(object[key], value) || (object[key] = value);
  }
  function updateIndexArtboard(target?: Dynamic, source?: Dynamic): Dynamic {
    for (let value of runtime.PlatformFileContentXYWValues as Dynamic)
      updateIndexProperty(
        target,
        value,
        typeof source[value] == "object"
          ? JSON.parse(JSON.stringify(source[value]))
          : source[value],
      );
  }
  function updateIndexAnnotation(target?: Dynamic, source?: Dynamic): Dynamic {
    let note: Dynamic = source;
    for (let value3 of INDEX_ANNOTATION_PROPERTIES as Dynamic)
      updateIndexProperty(target, value3, note[value3]);
    let path: Dynamic = typeof note.d == "string" ? note.d : undefined;
    updateIndexProperty(
      target,
      "d",
      path === undefined
        ? undefined
        : path.slice(0, MAX_NOTE_INLINE_PATH_CHARS),
    );
    updateIndexProperty(
      target,
      "d1",
      path !== undefined && path.length > MAX_NOTE_INLINE_PATH_CHARS
        ? path.slice(MAX_NOTE_INLINE_PATH_CHARS)
        : undefined,
    );
    let value: Dynamic = isPlainDesignIndexObject(note.css)
      ? note.css
      : undefined;
    if (value === undefined) updateIndexProperty(target, "css", undefined);
    else {
      let value3: Dynamic = isPlainDesignIndexObject(target.css)
        ? target.css
        : (target.css = {});
      for (let value4 of runtime.PlatformFileContentBackgroundBackgroundColorOpacityValues as Dynamic)
        updateIndexProperty(value3, value4, value[value4]);
    }
    let value2: Dynamic = isPlainDesignIndexObject(note.crop)
      ? note.crop
      : undefined;
    if (value2 === undefined) updateIndexProperty(target, "crop", undefined);
    else {
      let value3: Dynamic = isPlainDesignIndexObject(target.crop)
        ? target.crop
        : (target.crop = {});
      for (let value4 of ["zoom", "x", "y"] as Dynamic)
        updateIndexProperty(value3, value4, value2[value4]);
    }
  }
  function parseIndexDeletionSets(manifestText?: Dynamic): Dynamic {
    let deleted: Dynamic = {
      boards: new Set(),
      notes: new Set(),
      pages: new Set(),
    };
    if (manifestText === undefined || manifestText === "") return deleted;
    try {
      let value: Dynamic = JSON.parse(manifestText);
      if (Array.isArray(value?.artboards))
        for (let value2 of value.artboards as Dynamic)
          isPlainDesignIndexObject(value2) &&
            typeof value2.file == "string" &&
            deleted.boards.add(value2.file);
      if (Array.isArray(value?.annotations))
        for (let value2 of value.annotations as Dynamic)
          isPlainDesignIndexObject(value2) &&
            typeof value2.id == "string" &&
            deleted.notes.add(value2.id);
      if (Array.isArray(value?.pages))
        for (let value2 of value.pages as Dynamic)
          isPlainDesignIndexObject(value2) &&
            typeof value2.id == "string" &&
            deleted.pages.add(value2.id);
    } catch {}
    return deleted;
  }
  function updateDesignIndexFromDocument(
    index?: Dynamic,
    manifest?: Dynamic,
    title?: Dynamic,
    keepBoards: Dynamic = new Set(),
    keepNotes: Dynamic = new Set(),
    keepPages: Dynamic = new Set(),
  ): Dynamic {
    index.v < CURRENT_DESIGN_INDEX_VERSION &&
      (index.v = CURRENT_DESIGN_INDEX_VERSION);
    updateIndexProperty(index, "title", title);
    let value: Dynamic =
      manifest.launch !== undefined
        ? {
            ...manifest.launch,
          }
        : {};
    for (let value5 of ["view", "page", "file"] as Dynamic)
      updateIndexProperty(index.launch, value5, value[value5]);
    updateIndexProperty(index, "cover", manifest.cover);
    updateIndexProperty(
      index,
      "migrated",
      manifest.migrated === true ? true : undefined,
    );
    Array.isArray(index.pages) || (index.pages = []);
    let value2: Dynamic = (manifest.pages ?? []).map(
      (input?: Dynamic): Dynamic => ({
        id: input.id,
        name: input.name,
      }),
    );
    for (let index2: Dynamic = 0; index2 < index.pages.length; index2++) {
      let value5: Dynamic = index.pages[index2];
      if (
        !keepPages.has(value5.id) ||
        value2.some((input?: Dynamic): Dynamic => input.id === value5.id)
      )
        continue;
      let value6: Dynamic = -1;
      for (
        let value7: Dynamic = index2 - 1;
        value7 >= 0 && value6 < 0;
        value7--
      )
        value6 = value2.findIndex(
          (input?: Dynamic): Dynamic => input.id === index.pages[value7].id,
        );
      value2.splice(value6 + 1, 0, {
        id: value5.id,
        name: value5.name,
      });
    }
    equalDesignIndexJson(index.pages, value2) ||
      index.pages.splice(0, index.pages.length, ...value2);
    let values: Dynamic = new Set(
      manifest.artboards.map((input?: Dynamic): Dynamic => input.file),
    );
    for (let value5 of manifest.artboards as Dynamic)
      isPrototypeProperty(value5.file) ||
        updateIndexArtboard((index.boards[value5.file] ??= {}), value5);
    for (let value5 of Object.keys(index.boards) as Dynamic)
      !values.has(value5) &&
        !keepBoards.has(value5) &&
        delete index.boards[value5];
    let value3: Dynamic = manifest.artboards.map(
        (input?: Dynamic): Dynamic => input.file,
      ),
      order: Dynamic = index.order;
    for (let index2: Dynamic = 0; index2 < order.length; index2++) {
      let value5: Dynamic = order[index2];
      if (
        !keepBoards.has(value5) ||
        value3.includes(value5) ||
        !(value5 in index.boards)
      )
        continue;
      let value6: Dynamic = -1;
      for (
        let value7: Dynamic = index2 - 1;
        value7 >= 0 && value6 < 0;
        value7--
      )
        value6 = value3.indexOf(order[value7]);
      value3.splice(value6 + 1, 0, value5);
    }
    equalDesignIndexJson(order, value3) ||
      order.splice(0, order.length, ...value3);
    let value4: Dynamic = manifest.annotations ?? [],
      values2: Dynamic = new Set(
        value4.map((input?: Dynamic): Dynamic => input.id),
      );
    for (let value5 of value4 as Dynamic)
      isPrototypeProperty(value5.id) ||
        updateIndexAnnotation((index.notes[value5.id] ??= {}), value5);
    for (let value5 of Object.keys(index.notes) as Dynamic)
      !values2.has(value5) &&
        !keepNotes.has(value5) &&
        delete index.notes[value5];
  }
  function mergeDesignPages(
    base?: Dynamic,
    local?: Dynamic,
    remote?: Dynamic,
  ): Dynamic {
    let clonePages: Dynamic = (input?: Dynamic): Dynamic =>
      input.map(
        (input2?: Dynamic): Dynamic => ({
          ...input2,
        }),
      );
    if (equalDesignIndexJson(local, base))
      return {
        pages: clonePages(remote),
        overlap: false,
      };
    if (
      equalDesignIndexJson(remote, base) ||
      equalDesignIndexJson(local, remote)
    )
      return {
        pages: clonePages(local),
        overlap: false,
      };
    let entries: Dynamic = new Map(
        base.map((input?: Dynamic): Dynamic => [input.id, input]),
      ),
      entries2: Dynamic = new Map(
        local.map((input?: Dynamic): Dynamic => [input.id, input]),
      ),
      entries3: Dynamic = new Map(
        remote.map((input?: Dynamic): Dynamic => [input.id, input]),
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input
          .filter(
            (input2?: Dynamic): Dynamic =>
              entries.has(input2.id) &&
              entries2.has(input2.id) &&
              entries3.has(input2.id),
          )
          .map((input2?: Dynamic): Dynamic => input2.id),
      value: Dynamic = !equalDesignIndexJson(callback(local), callback(base)),
      value2: Dynamic = !equalDesignIndexJson(callback(remote), callback(base)),
      value3: Dynamic =
        value &&
        value2 &&
        !equalDesignIndexJson(callback(local), callback(remote)),
      [value4, value5, value6]: Dynamic =
        value && !value2
          ? [local, remote, entries3]
          : [remote, local, entries2],
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let entry: Dynamic = entries.get(input),
          entry2: Dynamic = entries2.get(input),
          entry3: Dynamic = entries3.get(input);
        return entry2 === undefined || entry3 === undefined
          ? (entry2 ?? entry3).name
          : entry === undefined ||
              entry2.name === entry3.name ||
              entry2.name === entry.name
            ? entry3.name
            : entry3.name === entry.name
              ? entry2.name
              : ((value3 = true), entry3.name);
      },
      value7: Dynamic = value4
        .filter(
          (input?: Dynamic): Dynamic =>
            !(entries.has(input.id) && !value6.has(input.id)),
        )
        .map(
          (input?: Dynamic): Dynamic => ({
            ...input,
            name: callback2(input.id),
          }),
        );
    value5.forEach((input?: Dynamic, options?: Dynamic): Dynamic => {
      if (
        entries.has(input.id) ||
        value7.some((input2?: Dynamic): Dynamic => input2.id === input.id)
      )
        return;
      let value8: Dynamic =
        (value4 === local ? value : value2) &&
        !value5
          .slice(options + 1)
          .some((input2?: Dynamic): Dynamic => entries.has(input2.id))
          ? value7.length
          : 0;
      for (
        let value9: Dynamic = options - 1;
        value9 >= 0 && value8 < value7.length;
        value9--
      ) {
        let value10: Dynamic = value7.findIndex(
          (input2?: Dynamic): Dynamic => input2.id === value5[value9].id,
        );
        if (value10 >= 0) {
          value8 = value10 + 1;
          break;
        }
      }
      value7.splice(value8, 0, {
        ...input,
      });
    });
    return {
      pages: value7,
      overlap: value3,
    };
  }
  function createDesignIndexFromFiles(
    title?: Dynamic,
    manifestText?: Dynamic,
    files?: Dynamic,
  ): Dynamic {
    let index: Dynamic = createEmptyDesignIndex(title);
    updateDesignIndexFromDocument(
      index,
      (0, runtime.parseCanvasMetadata)(manifestText, files),
      title,
    );
    return index;
  }
  bindRuntimeValue(
    runtime,
    "CURRENT_DESIGN_INDEX_VERSION",
    () => CURRENT_DESIGN_INDEX_VERSION,
    (value) => {
      CURRENT_DESIGN_INDEX_VERSION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INDEX_SOURCE_KEY",
    () => INDEX_SOURCE_KEY,
    (value) => {
      INDEX_SOURCE_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INDEX_DESIGN_SYSTEM_TOKENS_KEY",
    () => INDEX_DESIGN_SYSTEM_TOKENS_KEY,
    (value) => {
      INDEX_DESIGN_SYSTEM_TOKENS_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INDEX_LEFT_OUT_KEY",
    () => INDEX_LEFT_OUT_KEY,
    (value) => {
      INDEX_LEFT_OUT_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_NOTE_INLINE_PATH_CHARS",
    () => MAX_NOTE_INLINE_PATH_CHARS,
    (value) => {
      MAX_NOTE_INLINE_PATH_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_INDEX_MERGE_POLICY",
    () => FILES_INDEX_MERGE_POLICY,
    (value) => {
      FILES_INDEX_MERGE_POLICY = value;
    },
  );
  bindRuntimeValue(runtime, "orderedDesignMapKeys", () => orderedDesignMapKeys);
  bindRuntimeValue(
    runtime,
    "isPlainDesignIndexObject",
    () => isPlainDesignIndexObject,
    (value) => {
      isPlainDesignIndexObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPrototypeProperty",
    () => isPrototypeProperty,
    (value) => {
      isPrototypeProperty = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "equalDesignIndexJson",
    () => equalDesignIndexJson,
    (value) => {
      equalDesignIndexJson = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeDesignIndex", () => normalizeDesignIndex);
  bindRuntimeValue(
    runtime,
    "createEmptyDesignIndex",
    () => createEmptyDesignIndex,
    (value) => {
      createEmptyDesignIndex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeIndexArtboard",
    () => serializeIndexArtboard,
  );
  bindRuntimeValue(
    runtime,
    "deserializeIndexAnnotation",
    () => deserializeIndexAnnotation,
  );
  bindRuntimeValue(
    runtime,
    "isNonemptyIndexAnnotation",
    () => isNonemptyIndexAnnotation,
    (value) => {
      isNonemptyIndexAnnotation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildDesignDocumentFromIndex",
    () => buildDesignDocumentFromIndex,
  );
  bindRuntimeValue(
    runtime,
    "buildSelectedBoardsDocument",
    () => buildSelectedBoardsDocument,
  );
  bindRuntimeValue(runtime, "updateIndexProperty", () => updateIndexProperty);
  bindRuntimeValue(
    runtime,
    "INDEX_ANNOTATION_PROPERTIES",
    () => INDEX_ANNOTATION_PROPERTIES,
    (value) => {
      INDEX_ANNOTATION_PROPERTIES = value;
    },
  );
  bindRuntimeValue(runtime, "updateIndexArtboard", () => updateIndexArtboard);
  bindRuntimeValue(
    runtime,
    "updateIndexAnnotation",
    () => updateIndexAnnotation,
  );
  bindRuntimeValue(
    runtime,
    "parseIndexDeletionSets",
    () => parseIndexDeletionSets,
  );
  bindRuntimeValue(
    runtime,
    "updateDesignIndexFromDocument",
    () => updateDesignIndexFromDocument,
  );
  bindRuntimeValue(runtime, "mergeDesignPages", () => mergeDesignPages);
  bindRuntimeValue(
    runtime,
    "createDesignIndexFromFiles",
    () => createDesignIndexFromFiles,
  );
  return () => {
    CURRENT_DESIGN_INDEX_VERSION = 3;
    INDEX_SOURCE_KEY = "source";
    INDEX_DESIGN_SYSTEM_TOKENS_KEY = "designSystemTokens";
    INDEX_LEFT_OUT_KEY = "leftOut";
    MAX_NOTE_INLINE_PATH_CHARS = 16e3;
    FILES_INDEX_MERGE_POLICY = runtime.DESIGN_INDEX_MERGE_POLICY;
    isPlainDesignIndexObject = (input?: Dynamic): Dynamic =>
      typeof input == "object" && input !== null && !Array.isArray(input);
    isPrototypeProperty = (input?: Dynamic): Dynamic =>
      input in Object.prototype;
    equalDesignIndexJson = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input === options || JSON.stringify(input) === JSON.stringify(options);
    createEmptyDesignIndex = (input: Dynamic = ""): Dynamic =>
      normalizeDesignIndex({
        title: input,
      });
    isNonemptyIndexAnnotation = (source?: Dynamic): Dynamic =>
      source.kind === undefined ||
      source.kind === null ||
      (typeof source.text == "string" && source.text !== "") ||
      (typeof source.kind == "string" &&
        (Object.hasOwn(
          runtime.PlatformFileContentRectOvalLineConfig,
          source.kind,
        ) ||
          (0, runtime.PlatformFileContentTest)(source.kind) ||
          source.kind === "note" ||
          source.kind === "text"));
    INDEX_ANNOTATION_PROPERTIES = [
      "x",
      "y",
      "w",
      "h",
      "x2",
      "y2",
      "headStart",
      "headEnd",
      "rotate",
      "flipX",
      "flipY",
      "color",
      "page",
      "size",
      "kind",
      "bold",
      "italic",
      "fill",
      "text",
      "src",
      "video",
      "alt",
      "maxW",
      "maxH",
    ];
  };
}
