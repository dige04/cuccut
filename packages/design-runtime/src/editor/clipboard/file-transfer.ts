/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardFileTransfer(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardFileTransferKind: Dynamic;
  var ClipboardFileTransferHandler: Dynamic;
  var ClipboardFileTransferHandler_2: Dynamic;
  var ClipboardFileTransferHandler_3: Dynamic;
  var VideosCanTBePastedFromAnotherMessage: Dynamic;
  var ClipboardFileTransferToUpperCase: Dynamic;
  var ClipboardFileTransferHandler_4: Dynamic;
  var ClipboardFileTransferHandler_5: Dynamic;
  var ClipboardFileTransferHandler_6: Dynamic;
  var ClipboardFileTransferRegistry: Dynamic;
  var ClipboardFileTransferPasted: Dynamic;
  var ClipboardFileTransferSubscribers: Dynamic;
  var ClipboardFileTransferTest: Dynamic;
  var ClipboardFileTransferHandler_7: Dynamic;
  function isCarryableProjectFile(input?: Dynamic): Dynamic {
    let value: Dynamic = input.toLowerCase();
    return (
      ClipboardFileTransferHandler_7(input) &&
      (0, runtime.isSupportedProjectAsset)(input) &&
      value !== runtime.canvasMetadataFile &&
      !(0, runtime.isArtboardFile)(value) &&
      !ClipboardFileTransferSubscribers.has((0, runtime.fileBaseName)(value)) &&
      !ClipboardFileTransferTest(value)
    );
  }
  function dataUrlToBlob(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      /^data:([^;,]+)(?:;\s*charset="?[\w-]+"?)?(;base64)?,/i.exec(input);
    if (!value) return null;
    try {
      let value2: Dynamic = input.slice(value[0].length),
        value3: Dynamic = value[2]
          ? Uint8Array.from(
              atob(value2),
              (input2?: Dynamic): Dynamic => input2.charCodeAt(0),
            )
          : runtime.ClipboardArtboardsTextEncoder.encode(
              decodeURIComponent(value2),
            ),
        value4: Dynamic = (value[1].split("/")[1] ?? "png")
          .replace("jpeg", "jpg")
          .replace("svg+xml", "svg");
      return new File([value3], options + "." + value4, {
        type: value[1],
      });
    } catch {
      return null;
    }
  }
  function detectFontMimeType(items?: Dynamic): Dynamic {
    let value: Dynamic = String.fromCharCode(...items.subarray(0, 4));
    return value === "wOF2"
      ? "font/woff2"
      : value === "wOFF"
        ? "font/woff"
        : items.length < 5 || items[4] !== 0
          ? null
          : value === "OTTO"
            ? "font/otf"
            : value === "\0\0\0" || value === "true"
              ? "font/ttf"
              : null;
  }
  async function dataUrlToFontFile(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = dataUrlToBlob(input, options),
      value2: Dynamic = value
        ? detectFontMimeType(
            new Uint8Array(await value.slice(0, 5).arrayBuffer()),
          )
        : null;
    return value && value2
      ? new File([value], options + "." + value2.slice(5), {
          type: value2,
        })
      : null;
  }
  function fileDataUrl(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (
      /\.([a-z0-9]+)$/i.exec(input)?.[1] ?? "png"
    ).toLowerCase();
    return (
      "data:" +
      (value === "jpg"
        ? "image/jpeg"
        : value === "svg"
          ? "image/svg+xml"
          : "image/" + value) +
      ";base64," +
      options.replace(/\s+/g, "")
    );
  }
  function replaceClipboardReferences(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (options.size === 0) return input;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.replace(
          /[.*+?^${}()|[\]\\/]/g,
          (input3?: Dynamic): Dynamic => "\\" + input3,
        ),
      value: Dynamic = [...options.keys()]
        .sort(
          (items?: Dynamic, items2?: Dynamic): Dynamic =>
            items2.length - items.length,
        )
        .map(callback)
        .join("|");
    return input.replace(
      new RegExp("(?:\\.?/)?(" + value + ")", "g"),
      (items?: Dynamic, items2?: Dynamic): Dynamic => {
        let value2: Dynamic =
          items2.startsWith("_blob/") || items === items2
            ? options.get(items2)
            : items.slice(0, items.length - items2.length) +
              options.get(items2);
        if (context !== undefined) {
          let value3: Dynamic = value2.length - items.length;
          if (value3 > context.left) return items;
          value3 > 0 && (context.left -= value3);
        }
        return value2;
      },
    );
  }
  function preparePastedArtboardFiles(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = new Set(),
    extra: Dynamic = context
      ? runtime.PlatformFileContentResolvedValue_7
      : runtime.PlatformFileContentResolvedValue_11,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => input2.toLowerCase(),
      state: Dynamic = {
        ...options,
      },
      values: Dynamic = new Set(
        [...Object.keys(options), ...Object.keys(input.files)].map(callback),
      ),
      values2: Dynamic = new Set(
        value === "unknown" ? [] : [...value].map(callback),
      ),
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        values2.has(callback(input2)) ||
        values2.has(callback((0, runtime.fileBaseName)(input2))),
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        !values.has(callback(input2)) && !callback2(input2),
      entries: Dynamic = new Map(
        Object.keys(options).map(
          (input2?: Dynamic): Dynamic => [callback(input2), input2],
        ),
      ),
      entries2: Dynamic = new Map(
        Object.keys(options).map(
          (input2?: Dynamic): Dynamic => [
            (0, runtime.encodeStorePathSegment)(input2),
            input2,
          ],
        ),
      ),
      entries3: Dynamic = new Map(),
      values3: Dynamic = new Set(
        Object.keys(options)
          .filter(runtime.isArtboardFile)
          .map(
            (input2?: Dynamic): Dynamic =>
              callback((0, runtime.artboardBaseName)(input2)),
          ),
      ),
      values4: Dynamic = new Set(),
      value2: Dynamic = input.artboards.map((input2?: Dynamic): Dynamic => {
        let value4: Dynamic =
            ClipboardFileTransferHandler_7(input2.stem + ".dc.html") &&
            !ClipboardFileTransferTest(input2.stem)
              ? input2
              : {
                  ...input2,
                  stem: "Artboard",
                },
          value5: Dynamic = (0, runtime.uniqueArtboardFile)(
            state,
            value4.stem,
            context,
          );
        for (
          let count: Dynamic = 2;
          values3.has(callback((0, runtime.artboardBaseName)(value5))) ||
          (entries.has(callback(value5)) && options[value5] === undefined);
          count += 1
        )
          value5 = (0, runtime.uniqueArtboardFile)(
            state,
            value4.stem + String(count),
            context,
          );
        values3.add(callback((0, runtime.artboardBaseName)(value5)));
        values.add(callback(value5));
        state[value5] = value4.src;
        let value6: Dynamic = (0, runtime.artboardBaseName)(value4.stem);
        !values4.has(value6) &&
          (0, runtime.artboardBaseName)(value5) !== value6 &&
          entries3.set(value6, (0, runtime.artboardBaseName)(value5));
        values4.add(value6);
        return {
          path: value5,
          entry: value4,
        };
      }),
      entries4: Dynamic = new Map(),
      entries5: Dynamic = new Map(),
      values5: Dynamic = new Set(),
      value3: Dynamic = Object.keys(input.files);
    for (let value4 of [...value3, ...Object.keys(options)] as Dynamic) {
      let value5: Dynamic = callback((0, runtime.fileBaseName)(value4)),
        entry: Dynamic = entries5.get(value5);
      entry !== undefined &&
        entry !== value4 &&
        (callback(entry) !== callback(value4) ||
          (value3.includes(entry) && value3.includes(value4))) &&
        values5
          .add((0, runtime.fileBaseName)(value4))
          .add((0, runtime.fileBaseName)(entry))
          .add(value5);
      entries5.set(value5, value4);
    }
    for (let value4 of Object.keys(input.files) as Dynamic)
      /\s/.test(value4) && values5.add((0, runtime.fileBaseName)(value4));
    let callback4: Dynamic = (input2?: Dynamic): Dynamic =>
        values5.has((0, runtime.fileBaseName)(input2))
          ? input2
          : (0, runtime.fileBaseName)(input2),
      callback5: Dynamic = (items3?: Dynamic): Dynamic => {
        let value4: Dynamic = (0, runtime.fileBaseName)(items3).search(
            /(\.[^./]+)+$/,
          ),
          value5: Dynamic = items3.slice(
            0,
            items3.length - (0, runtime.fileBaseName)(items3).length,
          ),
          [value6, value7]: Dynamic =
            value4 < 0
              ? [(0, runtime.fileBaseName)(items3), ""]
              : [
                  (0, runtime.fileBaseName)(items3).slice(0, value4),
                  (0, runtime.fileBaseName)(items3).slice(value4),
                ],
          callback7: Dynamic = (input2?: Dynamic): Dynamic =>
            value === "unknown"
              ? Math.random().toString(36).slice(2, 6).padEnd(4, "0")
              : String(input2),
          value8: Dynamic = value5 + value6 + "-" + callback7(2) + value7;
        for (let count: Dynamic = 3; !callback3(value8); count += 1)
          value8 = value5 + value6 + "-" + callback7(count) + value7;
        return value8;
      },
      state2: Dynamic = {},
      values6: Dynamic = new Set(),
      items: Dynamic = [],
      items2: Dynamic = [],
      state3: Dynamic = {};
    for (let [value4, value5] of Object.entries(input.files) as Dynamic) {
      if (!isCarryableProjectFile(value4)) continue;
      let value6: Dynamic =
        entries.get(callback(value4)) ??
        (entries2.get((0, runtime.encodeStorePathSegment)(value4)) !== value4
          ? entries2.get((0, runtime.encodeStorePathSegment)(value4))
          : undefined);
      if (value6 !== undefined && options[value6] === value5) {
        items.push(value6);
        if (value6 !== value4) {
          let value7: Dynamic =
            callback4(value4) === value4 ||
            value4.slice(
              0,
              value4.length - (0, runtime.fileBaseName)(value4).length,
            ) !==
              value6.slice(
                0,
                value6.length - (0, runtime.fileBaseName)(value6).length,
              );
          value7 && values5.add((0, runtime.fileBaseName)(value4));
          entries4.set(
            value7 ? value4 : (0, runtime.fileBaseName)(value4),
            value7 ? value6 : (0, runtime.fileBaseName)(value6),
          );
        }
      } else if (
        context &&
        runtime.PlatformFileContentWebpAvifPattern.test(value4) &&
        value5.length > runtime.PlatformFileContentResolvedValue_7
      )
        state3[value4] = fileDataUrl(value4, value5);
      else if (
        runtime.ClipboardArtboardsTextEncoder.encode(value5).length > extra
      ) {
        items2.push({
          path: value4,
          why:
            "over this canvas's " +
            String(Math.floor(extra / 1024)) +
            " KB file limit",
        });
        if (value6 !== undefined || callback2(value4) || value === "unknown") {
          let value7: Dynamic = callback5(value4);
          values.add(callback(value7));
          entries4.set(
            callback4(value4),
            callback4(value4) === value4
              ? value7
              : (0, runtime.fileBaseName)(value7),
          );
        }
      } else if (
        value !== "unknown" &&
        value6 === undefined &&
        !values6.has(callback(value4)) &&
        !value2.some(
          (input2?: Dynamic): Dynamic =>
            callback(input2.path) === callback(value4),
        ) &&
        !callback2(value4)
      ) {
        state2[value4] = value5;
        values6.add(callback(value4));
      } else {
        let value7: Dynamic = callback5(value4);
        entries4.set(
          callback4(value4),
          callback4(value4) === value4
            ? value7
            : (0, runtime.fileBaseName)(value7),
        );
        state2[value7] = value5;
        values.add(callback(value7));
        values6.add(callback(value7));
      }
      state[value4] = value5;
    }
    let values7: Dynamic = new Set(
        [...entries4.keys()].filter(
          (input2?: Dynamic): Dynamic =>
            values5.has((0, runtime.fileBaseName)(input2)),
        ),
      ),
      callback6: Dynamic = (input2?: Dynamic): Dynamic =>
        (0, runtime.rewriteProjectReferences)(
          (0, runtime.renameComponentImports)(input2, entries3),
          entries4,
          values7,
        );
    for (let value4 of value2 as Dynamic)
      value4.entry = {
        ...value4.entry,
        src: callback6(value4.entry.src),
      };
    for (let value4 of Object.keys(state2) as Dynamic)
      (0, runtime.isProjectSourcePath)(value4) &&
        (state2[value4] = callback6(state2[value4]));
    return {
      boards: value2,
      files: state2,
      reused: items,
      dropped: items2,
      images: state3,
      ambiguous: values5,
    };
  }
  function remapPastedAssetFiles(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = runtime.PlatformFileContentResolvedValue_11,
  ): Dynamic {
    let entries: Dynamic = new Map(
        [...context].map(
          ([input2, input3]: Dynamic): Dynamic => [
            input.ambiguous.has((0, runtime.fileBaseName)(input2))
              ? input2
              : (0, runtime.fileBaseName)(input2),
            input3,
          ],
        ),
      ),
      values: Dynamic = new Set(
        [...entries.keys()].filter(
          (input2?: Dynamic): Dynamic =>
            input.ambiguous.has((0, runtime.fileBaseName)(input2)),
        ),
      ),
      value2: Dynamic = runtime.ClipboardArtboardsResolvedValue,
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        options2 === 0
          ? input2
          : new Map(
              [...input2].map(
                ([input3, input4]: Dynamic): Dynamic => [
                  input3,
                  input4.startsWith("./")
                    ? "../".repeat(options2) + input4.slice(2)
                    : input4,
                ],
              ),
            ),
      callback2: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
      ): Dynamic => {
        let value3: Dynamic = context2.split("/").length - 1,
          value4: Dynamic = callback(options, value3),
          state: Dynamic = {
            left: Math.max(
              0,
              Math.min(
                options2 -
                  runtime.ClipboardArtboardsTextEncoder.encode(input2).length,
                value2,
              ),
            ),
          },
          left: Dynamic = state.left,
          value5: Dynamic = (0, runtime.rewriteProjectReferences)(
            input2,
            callback(entries, value3),
            values,
            state,
          ),
          entries2: Dynamic = new Map(
            (0, runtime.getBlobAssetReferences)(value5)
              .filter(
                (input3?: Dynamic): Dynamic =>
                  value4.has(input3) && value4.get(input3) !== input3,
              )
              .map((input3?: Dynamic): Dynamic => [input3, value4.get(input3)]),
          );
        value5 = replaceClipboardReferences(value5, entries2, state);
        value2 -= left - state.left;
        return value5;
      };
    for (let value3 of input.boards as Dynamic)
      value3.entry = {
        ...value3.entry,
        src: callback2(
          value3.entry.src,
          runtime.PlatformFileContentResolvedValue_11,
          value3.path,
        ),
      };
    for (let value3 of Object.keys(input.files) as Dynamic)
      (0, runtime.isProjectSourcePath)(value3) &&
        (input.files[value3] = callback2(input.files[value3], value, value3));
  }
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferKind",
    () => ClipboardFileTransferKind,
    (value) => {
      ClipboardFileTransferKind = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferHandler",
    () => ClipboardFileTransferHandler,
    (value) => {
      ClipboardFileTransferHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferHandler_2",
    () => ClipboardFileTransferHandler_2,
    (value) => {
      ClipboardFileTransferHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferHandler_3",
    () => ClipboardFileTransferHandler_3,
    (value) => {
      ClipboardFileTransferHandler_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VideosCanTBePastedFromAnotherMessage",
    () => VideosCanTBePastedFromAnotherMessage,
    (value) => {
      VideosCanTBePastedFromAnotherMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferToUpperCase",
    () => ClipboardFileTransferToUpperCase,
    (value) => {
      ClipboardFileTransferToUpperCase = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferHandler_4",
    () => ClipboardFileTransferHandler_4,
    (value) => {
      ClipboardFileTransferHandler_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferHandler_5",
    () => ClipboardFileTransferHandler_5,
    (value) => {
      ClipboardFileTransferHandler_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferHandler_6",
    () => ClipboardFileTransferHandler_6,
    (value) => {
      ClipboardFileTransferHandler_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferRegistry",
    () => ClipboardFileTransferRegistry,
    (value) => {
      ClipboardFileTransferRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferPasted",
    () => ClipboardFileTransferPasted,
    (value) => {
      ClipboardFileTransferPasted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferSubscribers",
    () => ClipboardFileTransferSubscribers,
    (value) => {
      ClipboardFileTransferSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferTest",
    () => ClipboardFileTransferTest,
    (value) => {
      ClipboardFileTransferTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardFileTransferHandler_7",
    () => ClipboardFileTransferHandler_7,
    (value) => {
      ClipboardFileTransferHandler_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isCarryableProjectFile",
    () => isCarryableProjectFile,
  );
  bindRuntimeValue(runtime, "dataUrlToBlob", () => dataUrlToBlob);
  bindRuntimeValue(runtime, "detectFontMimeType", () => detectFontMimeType);
  bindRuntimeValue(runtime, "dataUrlToFontFile", () => dataUrlToFontFile);
  bindRuntimeValue(runtime, "fileDataUrl", () => fileDataUrl);
  bindRuntimeValue(
    runtime,
    "replaceClipboardReferences",
    () => replaceClipboardReferences,
  );
  bindRuntimeValue(
    runtime,
    "preparePastedArtboardFiles",
    () => preparePastedArtboardFiles,
  );
  bindRuntimeValue(
    runtime,
    "remapPastedAssetFiles",
    () => remapPastedAssetFiles,
  );
  return () => {
    ClipboardFileTransferKind = (items?: Dynamic): Dynamic => {
      let callback: Dynamic = (source?: Dynamic): Dynamic =>
          source.kind === "image"
            ? "picture"
            : (0, runtime.isShapeAnnotation)(source)
              ? "shape"
              : "note",
        value: Dynamic = ["note", "shape", "picture"].filter(
          (input?: Dynamic): Dynamic =>
            items.some(
              (input2?: Dynamic): Dynamic => callback(input2) === input,
            ),
        ),
        value2: Dynamic = String(items.length);
      return value.length === 1
        ? value2 + " " + value[0] + (items.length === 1 ? "" : "s")
        : value2 +
            " " +
            value
              .slice(0, -1)
              .map((input?: Dynamic): Dynamic => input + "s")
              .join(", ") +
            " and " +
            value.at(-1) +
            "s";
    };
    ClipboardFileTransferHandler = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      input === 1 ? "1 " + options : String(input) + " " + options + "s";
    ClipboardFileTransferHandler_2 = (input?: Dynamic): Dynamic =>
      `; ${input === 1 ? "1 note or shape" : String(input) + " notes and shapes"} could not be read`;
    ClipboardFileTransferHandler_3 = (input?: Dynamic): Dynamic =>
      `; ${input === 1 ? "1 shape" : String(input) + " shapes"} left out (copy ${input === 1 ? "it" : "them"} with an artboard to bring ${input === 1 ? "it" : "them"})`;
    VideosCanTBePastedFromAnotherMessage =
      "videos can't be pasted from another canvas yet";
    ClipboardFileTransferToUpperCase = (input?: Dynamic): Dynamic =>
      input.charAt(0).toUpperCase() + input.slice(1);
    ClipboardFileTransferHandler_4 = (
      input?: Dynamic,
      options: Dynamic = 0,
    ): Dynamic => {
      let value: Dynamic = input - options;
      return (
        (options > 0
          ? `; ${ClipboardFileTransferHandler(options, "video")} left out (${VideosCanTBePastedFromAnotherMessage})`
          : "") +
        (value > 0
          ? `; ${ClipboardFileTransferHandler(value, "picture")} left out (${ClipboardFileTransferHandler_5(value)})`
          : "")
      );
    };
    ClipboardFileTransferHandler_5 = (input?: Dynamic): Dynamic =>
      `copy ${input === 1 ? "it" : "them"} again, or add ${input === 1 ? "it" : "them"} to this canvas instead`;
    ClipboardFileTransferHandler_6 = (input?: Dynamic): Dynamic =>
      `the copied ${input === 1 ? "picture wasn't" : "pictures weren't"} included`;
    ClipboardFileTransferRegistry = {
      pasted: (
        items?: Dynamic,
        options?: Dynamic,
        context: Dynamic = 0,
        value: Dynamic = 0,
        extra: Dynamic = {},
      ): Dynamic =>
        (items.length > 0
          ? "Pasted " +
            ClipboardFileTransferKind(items) +
            " from another canvas"
          : "Nothing pasted") +
        (context > 0 ? ClipboardFileTransferHandler_2(context) : "") +
        (value > 0 ? ClipboardFileTransferHandler_3(value) : "") +
        (items.length > 0 && (extra.plain ?? 0) > 0
          ? ClipboardFileTransferRegistry.plainPictures(extra.plain ?? 0, false)
          : "") +
        ((extra.failed ?? 0) > 0
          ? ClipboardFileTransferRegistry.notBrought(extra.failed ?? 0)
          : "") +
        ((extra.overCap ?? 0) > 0
          ? `; ${ClipboardFileTransferHandler(extra.overCap ?? 0, "more picture")} left out (a paste brings up to ${String(runtime.ClipboardAnnotationsLimit)}: copy the rest separately)`
          : "") +
        ClipboardFileTransferHandler_4(options, extra.videos),
      withObjects: (input?: Dynamic): Dynamic =>
        " with " + ClipboardFileTransferKind(input),
      onlyLeftOut: (input?: Dynamic, options: Dynamic = 0): Dynamic =>
        input - options <= 0
          ? `Nothing to paste: ${VideosCanTBePastedFromAnotherMessage}. Add ${options === 1 ? "the video" : "them"} to this canvas instead.`
          : `Nothing to paste: ${ClipboardFileTransferHandler_6(input - options)}. ${ClipboardFileTransferToUpperCase(ClipboardFileTransferHandler_5(input - options))}.` +
            (options > 0
              ? ` ${ClipboardFileTransferToUpperCase(VideosCanTBePastedFromAnotherMessage)}.`
              : ""),
      onlyShapes:
        "Nothing to paste: shapes paste into another canvas only together with an artboard. Copy them with one to bring them.",
      alsoLeftOut: (input?: Dynamic, options: Dynamic = 0): Dynamic =>
        (options > 0
          ? ` ${ClipboardFileTransferToUpperCase(VideosCanTBePastedFromAnotherMessage)}.`
          : "") +
        (input - options > 0
          ? ` ${ClipboardFileTransferToUpperCase(ClipboardFileTransferHandler_6(input - options))}: ${ClipboardFileTransferHandler_5(input - options)}.`
          : ""),
      notBrought: (input?: Dynamic): Dynamic =>
        `; ${ClipboardFileTransferHandler(input, "picture")} could not be brought over (try again, or add ${input === 1 ? "it" : "them"} to this canvas instead)`,
      bringing: (input?: Dynamic): Dynamic =>
        `Pasting ${input === 1 ? "a picture" : String(input) + " pictures"} from another canvas\u2026`,
      stillPasting: "Still working on the previous paste\u2026",
      picturesNotReady: (input?: Dynamic): Dynamic =>
        `Copied. ${input === 1 ? "One picture wasn't" : String(input) + " pictures weren't"} ready yet, so another canvas would go without ${input === 1 ? "it" : "them"}. Copy again in a moment. Paste here still works.`,
      picturesCantGo: (input?: Dynamic): Dynamic =>
        `Copied. ${input === 1 ? "One picture" : String(input) + " pictures"} can't go to another canvas; add ${input === 1 ? "it" : "them"} to that canvas instead. Paste here still works.`,
      picturesWontFit: (input?: Dynamic): Dynamic =>
        `Copied. ${input === 1 ? "One picture" : String(input) + " pictures"} didn't fit with the rest to go to another canvas: copy fewer at a time. Paste here still works.`,
      picturesOverCap: (input?: Dynamic): Dynamic =>
        `Copied. Another canvas takes ${String(runtime.ClipboardAnnotationsLimit)} pictures a paste: copy the other ${input === 1 ? "one" : String(input)} separately. Paste here still works.`,
      wontFitPictures:
        "Couldn't paste: this would make the canvas too large to save. Delete something here first.",
      atLimit: `Couldn't paste: this would take the canvas past its limit of ${String(runtime.PlatformFileContentLimit_5)} notes, shapes and pictures. Delete some here first, or paste fewer.`,
      tooMuchUnasked:
        "Nothing pasted: this is more than can be pasted from another canvas at once. Copy fewer notes at a time.",
      tooMuchStayed:
        "Nothing pasted: this is more than can be pasted from another canvas at once. Copy less at a time.",
      leftOutCaveat: ClipboardFileTransferHandler_4,
      unreadable:
        "Nothing to paste: the copied notes and shapes could not be read.",
      tooLargeToCopy:
        "Copied. This is more than can be pasted into another canvas at once: copy less at a time. Paste here still works.",
      tooManyNotesToCopy:
        "Copied. This is more than can be pasted into another canvas at once: copy fewer notes at a time. Paste here still works.",
      stayedBehind:
        "; the notes and shapes stayed behind (too large to come with the artboards)",
      tooLargeBesideArtboards:
        "Copied. The artboards will paste into another canvas, but the notes and shapes won't fit with them: copy fewer of them with the artboards. Paste here still works.",
      wontFit:
        "Couldn't paste: the notes would make this canvas too large to save. Copy fewer at a time, or delete something here first.",
      notLanded:
        "; nothing else you copied was pasted (it would take this canvas past its limit: copy less at a time, or delete something here first)",
      notRead: "; the notes and shapes could not be read",
      plainShapes: (input?: Dynamic): Dynamic =>
        `; ${input === 1 ? "1 shape lost its styling" : String(input) + " shapes lost their styling"} (Paste with code keeps it)`,
      plainPictures: (input?: Dynamic, options?: Dynamic): Dynamic =>
        `; ${ClipboardFileTransferHandler(input, "picture")} lost some effects (${options ? "Paste with code keeps them" : `to keep them, copy ${input === 1 ? "it" : "them"} with an artboard and choose Paste with code`})`,
      notesTooMuch:
        "; the notes were left out: copy fewer at a time (this is more than can be pasted from another canvas at once)",
      someUnread: ClipboardFileTransferHandler_2,
      alsoUnread: (input?: Dynamic): Dynamic =>
        ` ${input === 1 ? "1 note or shape" : String(input) + " notes and shapes"} could not be read.`,
      notesStayedToo:
        " The notes and shapes are too large to go with the artboards: copy fewer of them with the artboards.",
      notEither: " The notes and shapes were not pasted either.",
      pressAgain: (input?: Dynamic): Dynamic =>
        `Press ${input} again to paste what you copied in another canvas.`,
    };
    ClipboardFileTransferPasted = (input?: Dynamic, items?: Dynamic): Dynamic =>
      items.length > 0 &&
      input === ClipboardFileTransferRegistry.pasted(items, 0);
    ClipboardFileTransferSubscribers = new Set([
      "support.js",
      "react.js",
      "react-dom.js",
    ]);
    ClipboardFileTransferTest = (input?: Dynamic): Dynamic =>
      /^(?:artifact-type|project)\//i.test(input);
    ClipboardFileTransferHandler_7 = (items?: Dynamic): Dynamic =>
      (0, runtime.isSafeProjectPath)(items) &&
      items.length <= runtime.PlatformFileContentLimit_8 - 16;
  };
}
