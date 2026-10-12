/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardArtboards(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardArtboardsResolvedValue: Dynamic;
  var ClipboardArtboardsLimit: Dynamic;
  var ClipboardArtboardsResolvedValue_2: Dynamic;
  var ClipboardArtboardsBlobBlobPattern: Dynamic;
  var ClipboardArtboardsDataImagePattern: Dynamic;
  var ClipboardArtboardsDataTextPattern: Dynamic;
  var ClipboardArtboardsTest: Dynamic;
  var ClipboardArtboardsDataFontPattern: Dynamic;
  var ClipboardArtboardsDataFontPattern_2: Dynamic;
  var ClipboardArtboardsTest_2: Dynamic;
  var ClipboardArtboardsLimit_2: Dynamic;
  var ClipboardArtboardsConstant: Dynamic;
  var ClipboardArtboardsTest_3: Dynamic;
  var ClipboardArtboardsConstant_2: Dynamic;
  var ClipboardArtboardsReplace: Dynamic;
  var ClipboardArtboardsTest_4: Dynamic;
  var ClipboardArtboardsAZaZPattern: Dynamic;
  var ClipboardArtboardsConstant_3: Dynamic;
  var ClipboardArtboardsConstant_4: Dynamic;
  var ClipboardArtboardsBlobPattern: Dynamic;
  var ClipboardArtboardsBlobHttpsPattern: Dynamic;
  var ClipboardArtboardsReplace_2: Dynamic;
  var artboardBaseName: Dynamic;
  var fileBaseName: Dynamic;
  var clipboardSourceStrings: Dynamic;
  var ClipboardArtboardsTextEncoder: Dynamic;
  var ClipboardArtboardsEncode: Dynamic;
  var ClipboardArtboardsMax: Dynamic;
  function referencedAssetFiles(input?: Dynamic, items?: Dynamic): Dynamic {
    if (items.length === 0) return [];
    let values: Dynamic = new Set(input.flatMap(getBlobAssetReferences)),
      values2: Dynamic = new Set(
        items
          .filter((input2?: Dynamic): Dynamic => values.has(input2.ref))
          .map(
            (input2?: Dynamic): Dynamic =>
              ClipboardArtboardsReplace(input2.path),
          ),
      );
    return items
      .filter(
        (input2?: Dynamic): Dynamic =>
          values2.has(ClipboardArtboardsReplace(input2.path)) &&
          ClipboardArtboardsTest_4(input2.path),
      )
      .slice(0, ClipboardArtboardsConstant_2);
  }
  function getBlobAssetReferences(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set();
    if (input.includes("_blob/"))
      for (let value of input.matchAll(
        ClipboardArtboardsBlobPattern,
      ) as Dynamic)
        values.add("_blob/" + value[1]);
    if (input.includes("blob:") && (0, runtime.isEmulatorBlobUrl)("blob:"))
      for (let value of input.matchAll(
        ClipboardArtboardsBlobHttpsPattern,
      ) as Dynamic)
        values.add(value[0]);
    return [...values];
  }
  function collectArtboardClipboardSource(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.filter(
      (input2?: Dynamic): Dynamic =>
        typeof context[input2.file] == "string" &&
        !(0, runtime.isLoadingArtboardHtml)(context[input2.file]),
    );
    if (value.length === 0) return null;
    let value2: Dynamic = Math.min(
        ...value.map((input2?: Dynamic): Dynamic => input2.x),
      ),
      value3: Dynamic = Math.min(
        ...value.map((input2?: Dynamic): Dynamic => input2.y),
      ),
      callback: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
      ): Dynamic => ({
        src: context[input2.file],
        stem: ClipboardArtboardsReplace_2(input2.file),
        dx: options2,
        dy: context2,
        w: input2.w,
        h: input2.h,
        ...(input2.title
          ? {
              title: input2.title,
            }
          : {}),
        ...(0, runtime.artboardAppearanceProperties)(input2),
      }),
      value4: Dynamic = value.map(
        (input2?: Dynamic): Dynamic =>
          callback(input2, input2.x - value2, input2.y - value3),
      ),
      entries: Dynamic = new Map(
        Object.keys(context)
          .filter(runtime.isArtboardFile)
          .map(
            (input2?: Dynamic): Dynamic => [artboardBaseName(input2), input2],
          ),
      ),
      values: Dynamic = new Set(
        value.map((input2?: Dynamic): Dynamic => input2.file),
      ),
      value5: Dynamic =
        Math.max(
          ...value4.map((input2?: Dynamic): Dynamic => input2.dx + input2.w),
        ) + ClipboardArtboardsConstant_3;
    for (let index: Dynamic = 0; index < value4.length; index++)
      for (let value6 of (0, runtime.getImportedArtboardNames)(
        value4[index].src,
      ) as Dynamic) {
        let entry: Dynamic = entries.get(value6);
        if (
          entry === undefined ||
          values.has(entry) ||
          (0, runtime.isLoadingArtboardHtml)(context[entry])
        )
          continue;
        values.add(entry);
        let value7: Dynamic = options.find(
          (input2?: Dynamic): Dynamic => input2.file === entry,
        ) ?? {
          file: entry,
          x: 0,
          y: 0,
          ...(0, runtime.artboardSpecFromProps)({}),
        };
        value4.push(callback(value7, value5, 0));
        value5 += value7.w + ClipboardArtboardsConstant_3;
      }
    let state: Dynamic = {};
    for (let [value6, value7] of Object.entries(context) as Dynamic)
      !(0, runtime.isArtboardFile)(value6) &&
        value6 !== runtime.canvasMetadataFile &&
        (state[value6] = value7);
    let state2: Dynamic = {};
    for (let value6 of value4 as Dynamic) {
      let value7: Dynamic = value6.stem + ".dc.html";
      for (let [value8, value9] of Object.entries(
        (0, runtime.collectProjectDependencyFiles)(
          {
            ...state,
            [value7]: value6.src,
          },
          value7,
        ),
      ) as Dynamic)
        value8 !== value7 && (state2[value8] = value9);
    }
    return {
      artboards: value4,
      carried: state2,
      origin: {
        x: value2,
        y: value3,
      },
    };
  }
  function clipboardBlobAssets(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = [],
  ): Dynamic {
    if (
      !Object.values(context).some(
        (input2?: Dynamic): Dynamic =>
          getBlobAssetReferences(input2).length > 0,
      )
    )
      return [];
    let value2: Dynamic = collectArtboardClipboardSource(
      input,
      options,
      context,
    );
    if (value2 === null) return [];
    let value3: Dynamic = clipboardSourceStrings(value2);
    return [
      ...new Set([
        ...value3.flatMap(getBlobAssetReferences),
        ...referencedAssetFiles(value3, value).map(
          (input2?: Dynamic): Dynamic => input2.ref,
        ),
      ]),
    ];
  }
  function buildArtboardClipboard(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = [],
  ): Dynamic {
    let value2: Dynamic = collectArtboardClipboardSource(
      input,
      options,
      context,
    );
    if (value2 === null) return null;
    let {
        artboards: value3,
        carried: value4,
        origin: value5,
      }: Dynamic = value2,
      state: Dynamic = {},
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(),
      entries: Dynamic = new Map(),
      index: Dynamic = 0,
      value6: Dynamic = clipboardSourceStrings(value2),
      value7: Dynamic = referencedAssetFiles(value6, extra);
    for (let value12 of [
      ...value6.flatMap(getBlobAssetReferences),
      ...value7.map((input2?: Dynamic): Dynamic => input2.ref),
    ] as Dynamic) {
      if (
        state[value12] !== undefined ||
        entries.has(value12) ||
        values.has(value12) ||
        values2.has(value12)
      )
        continue;
      let value13: Dynamic = value(value12);
      value13 === undefined
        ? values.add(value12)
        : value13.length > ClipboardArtboardsResolvedValue_2 ||
            !ClipboardArtboardsTest_3(value13)
          ? (values2.add(value12),
            ClipboardArtboardsDataFontPattern_2.test(value13) && (index += 1))
          : ClipboardArtboardsDataFontPattern.test(value13)
            ? entries.set(value12, value13)
            : Object.keys(state).length < ClipboardArtboardsLimit
              ? (state[value12] = value13)
              : values.add(value12);
    }
    let value8: Dynamic = Object.fromEntries(
        value7
          .filter(
            (input2?: Dynamic): Dynamic => state[input2.ref] !== undefined,
          )
          .map((input2?: Dynamic): Dynamic => [input2.path, input2.ref]),
      ),
      state2: Dynamic = {
        v: 1,
        artboards: value3,
        files: value4,
        assets: state,
        ...(Object.keys(value8).length > 0
          ? {
              held: value8,
            }
          : {}),
      },
      callback: Dynamic = (): Dynamic => ({
        missingAssets: values.size,
        unsupportedAssets: values2.size,
      }),
      index2: Dynamic = 0;
    for (let value12 of value3 as Dynamic) index2 += value12.src.length;
    for (let value12 of Object.values(value4) as Dynamic)
      index2 += value12.length;
    for (let value12 of Object.values(state) as Dynamic)
      index2 += value12.length;
    if (index2 > ClipboardArtboardsResolvedValue)
      return {
        clip: state2,
        json: "",
        ...callback(),
        origin: value5,
        tooLarge: true,
      };
    let value9: Dynamic = JSON.stringify(state2),
      value10: Dynamic =
        ClipboardArtboardsResolvedValue -
        value9.length -
        ClipboardArtboardsConstant;
    if (value10 < 0)
      for (let value12 of entries.keys() as Dynamic) values2.add(value12);
    if (value10 < 0 || (entries.size === 0 && index === 0))
      return {
        clip: state2,
        json: value9,
        ...callback(),
        origin: value5,
        tooLarge: value9.length > ClipboardArtboardsResolvedValue,
      };
    let index3: Dynamic = 0;
    for (let [value12, value13] of entries as Dynamic) {
      let value14: Dynamic =
        JSON.stringify(value12).length + JSON.stringify(value13).length + 2;
      index3 < ClipboardArtboardsLimit_2 &&
      Object.keys(state).length < ClipboardArtboardsLimit &&
      value14 <= value10
        ? ((state[value12] = value13), (value10 -= value14), (index3 += 1))
        : (index += 1);
    }
    index > 0 && (state2.fontsLeftOut = index);
    let value11: Dynamic = JSON.stringify(state2);
    return {
      clip: state2,
      json: value11,
      ...callback(),
      origin: value5,
      tooLarge: value11.length > ClipboardArtboardsResolvedValue,
    };
  }
  function parseArtboardClipboard(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return null;
    let value: Dynamic = input;
    if (!Array.isArray(value.artboards)) return null;
    let index: Dynamic = 0,
      callback: Dynamic = (items4?: Dynamic): Dynamic =>
        (index += items4.length) <= ClipboardArtboardsResolvedValue,
      items: Dynamic = [];
    for (let value5 of value.artboards as Dynamic) {
      if (items.length >= runtime.PlatformFileContentFilesValue) break;
      if (typeof value5 != "object" || value5 === null) continue;
      let value6: Dynamic = value5;
      if (
        typeof value6.src != "string" ||
        !ClipboardArtboardsEncode(value6.src)
      )
        continue;
      if (!callback(value6.src)) return null;
      let value7: Dynamic =
        typeof value6.stem == "string" &&
        (0, runtime.ClipboardFileTransferHandler_7)(value6.stem + ".dc.html") &&
        !(0, runtime.ClipboardFileTransferTest)(value6.stem)
          ? value6.stem
          : "Artboard";
      items.push({
        src: value6.src,
        stem: value7,
        dx: ClipboardArtboardsMax(value6.dx),
        dy: ClipboardArtboardsMax(value6.dy),
        ...(0, runtime.artboardSpecFromProps)(value6),
      });
    }
    if (items.length === 0) return null;
    let state: Dynamic = {};
    if (typeof value.files == "object" && value.files !== null) {
      let index3: Dynamic = 0;
      for (let [value5, value6] of Object.entries(value.files) as Dynamic) {
        if (index3 >= runtime.PlatformFileContentFilesValue) break;
        if (
          !(
            !(0, runtime.isCarryableProjectFile)(value5) ||
            typeof value6 != "string" ||
            !ClipboardArtboardsEncode(value6)
          ) &&
          !(
            runtime.PlatformFileContentWebpAvifPattern.test(value5) &&
            !ClipboardArtboardsAZaZPattern.test(value6)
          )
        ) {
          if (!callback(value6)) return null;
          state[value5] = value6;
          index3 += 1;
        }
      }
    }
    let state2: Dynamic = {},
      index2: Dynamic = 0;
    if (typeof value.assets == "object" && value.assets !== null) {
      let index3: Dynamic = 0,
        index4: Dynamic = 0;
      for (let [value5, value6] of Object.entries(value.assets) as Dynamic) {
        if (index3 >= ClipboardArtboardsLimit) break;
        if (
          !(
            !ClipboardArtboardsBlobBlobPattern.test(value5) ||
            typeof value6 != "string" ||
            value6.length > ClipboardArtboardsResolvedValue_2 ||
            !ClipboardArtboardsTest_3(value6)
          )
        ) {
          if (ClipboardArtboardsDataFontPattern.test(value6)) {
            if (index4 >= ClipboardArtboardsLimit_2) {
              index2 += 1;
              continue;
            }
            index4 += 1;
          }
          if (!callback(value6)) return null;
          state2[value5] = value6;
          index3 += 1;
        }
      }
    }
    let items2: Dynamic = [
        ...items.map((input2?: Dynamic): Dynamic => input2.src),
        ...Object.entries(state)
          .filter(
            ([input2]: Dynamic): Dynamic =>
              (0, runtime.isProjectSourcePath)(input2),
          )
          .map(([, input2]: Dynamic): Dynamic => input2),
      ],
      items3: Dynamic = [];
    if (typeof value.held == "object" && value.held !== null)
      for (let [value5, value6] of Object.entries(value.held) as Dynamic) {
        if (items3.length >= ClipboardArtboardsConstant_2 * 4) break;
        ClipboardArtboardsTest_4(value5) &&
          typeof value6 == "string" &&
          state2[value6] !== undefined &&
          ClipboardArtboardsTest(state2[value6]) &&
          items3.push({
            path: value5,
            ref: value6,
          });
      }
    let value2: Dynamic = Object.fromEntries(
        referencedAssetFiles(items2, items3).map(
          (input2?: Dynamic): Dynamic => [input2.path, input2.ref],
        ),
      ),
      values: Dynamic = new Set([
        ...items2.flatMap(getBlobAssetReferences),
        ...Object.values(value2),
      ]);
    for (let value5 of Object.keys(state2) as Dynamic)
      values.has(value5) || delete state2[value5];
    let length: Dynamic = [...values].filter(
        (input2?: Dynamic): Dynamic => state2[input2] === undefined,
      ).length,
      value3: Dynamic =
        typeof value.fontsLeftOut == "number" &&
        Number.isInteger(value.fontsLeftOut)
          ? Math.max(0, value.fontsLeftOut)
          : 0,
      value4: Dynamic = Math.min(
        length,
        value3 + index2,
        ClipboardArtboardsLimit,
      );
    return {
      v: 1,
      artboards: items,
      files: state,
      assets: state2,
      ...(Object.keys(value2).length > 0
        ? {
            held: value2,
          }
        : {}),
      ...(value4 > 0
        ? {
            fontsLeftOut: value4,
          }
        : {}),
    };
  }
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsResolvedValue",
    () => ClipboardArtboardsResolvedValue,
    (value) => {
      ClipboardArtboardsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsLimit",
    () => ClipboardArtboardsLimit,
    (value) => {
      ClipboardArtboardsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsResolvedValue_2",
    () => ClipboardArtboardsResolvedValue_2,
    (value) => {
      ClipboardArtboardsResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsBlobBlobPattern",
    () => ClipboardArtboardsBlobBlobPattern,
    (value) => {
      ClipboardArtboardsBlobBlobPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsDataImagePattern",
    () => ClipboardArtboardsDataImagePattern,
    (value) => {
      ClipboardArtboardsDataImagePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsDataTextPattern",
    () => ClipboardArtboardsDataTextPattern,
    (value) => {
      ClipboardArtboardsDataTextPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsTest",
    () => ClipboardArtboardsTest,
    (value) => {
      ClipboardArtboardsTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsDataFontPattern",
    () => ClipboardArtboardsDataFontPattern,
    (value) => {
      ClipboardArtboardsDataFontPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsDataFontPattern_2",
    () => ClipboardArtboardsDataFontPattern_2,
    (value) => {
      ClipboardArtboardsDataFontPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsTest_2",
    () => ClipboardArtboardsTest_2,
    (value) => {
      ClipboardArtboardsTest_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsLimit_2",
    () => ClipboardArtboardsLimit_2,
    (value) => {
      ClipboardArtboardsLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsConstant",
    () => ClipboardArtboardsConstant,
    (value) => {
      ClipboardArtboardsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsTest_3",
    () => ClipboardArtboardsTest_3,
    (value) => {
      ClipboardArtboardsTest_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsConstant_2",
    () => ClipboardArtboardsConstant_2,
    (value) => {
      ClipboardArtboardsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsReplace",
    () => ClipboardArtboardsReplace,
    (value) => {
      ClipboardArtboardsReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsTest_4",
    () => ClipboardArtboardsTest_4,
    (value) => {
      ClipboardArtboardsTest_4 = value;
    },
  );
  bindRuntimeValue(runtime, "referencedAssetFiles", () => referencedAssetFiles);
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsAZaZPattern",
    () => ClipboardArtboardsAZaZPattern,
    (value) => {
      ClipboardArtboardsAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsConstant_3",
    () => ClipboardArtboardsConstant_3,
    (value) => {
      ClipboardArtboardsConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsConstant_4",
    () => ClipboardArtboardsConstant_4,
    (value) => {
      ClipboardArtboardsConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsBlobPattern",
    () => ClipboardArtboardsBlobPattern,
    (value) => {
      ClipboardArtboardsBlobPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsBlobHttpsPattern",
    () => ClipboardArtboardsBlobHttpsPattern,
    (value) => {
      ClipboardArtboardsBlobHttpsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getBlobAssetReferences",
    () => getBlobAssetReferences,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsReplace_2",
    () => ClipboardArtboardsReplace_2,
    (value) => {
      ClipboardArtboardsReplace_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardBaseName",
    () => artboardBaseName,
    (value) => {
      artboardBaseName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBaseName",
    () => fileBaseName,
    (value) => {
      fileBaseName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectArtboardClipboardSource",
    () => collectArtboardClipboardSource,
  );
  bindRuntimeValue(
    runtime,
    "clipboardSourceStrings",
    () => clipboardSourceStrings,
    (value) => {
      clipboardSourceStrings = value;
    },
  );
  bindRuntimeValue(runtime, "clipboardBlobAssets", () => clipboardBlobAssets);
  bindRuntimeValue(
    runtime,
    "buildArtboardClipboard",
    () => buildArtboardClipboard,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsTextEncoder",
    () => ClipboardArtboardsTextEncoder,
    (value) => {
      ClipboardArtboardsTextEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsEncode",
    () => ClipboardArtboardsEncode,
    (value) => {
      ClipboardArtboardsEncode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardArtboardsMax",
    () => ClipboardArtboardsMax,
    (value) => {
      ClipboardArtboardsMax = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseArtboardClipboard",
    () => parseArtboardClipboard,
  );
  return () => {
    ClipboardArtboardsResolvedValue = 8 * 1024 * 1024;
    ClipboardArtboardsLimit = 80;
    ClipboardArtboardsResolvedValue_2 = 6 * 1024 * 1024;
    ClipboardArtboardsBlobBlobPattern =
      /^(?:_blob\/[0-9a-f]{32}|blob:https?:\/\/[A-Za-z0-9.:-]{1,80}\/[0-9a-f-]{36})$/;
    ClipboardArtboardsDataImagePattern =
      /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,[A-Za-z0-9+/=\s]*$/i;
    ClipboardArtboardsDataTextPattern =
      /^data:(?:text\/(?:css|javascript|plain)|application\/json)(?:;\s*charset="?[\w-]+"?)?;base64,[A-Za-z0-9+/=\s]*$/i;
    ClipboardArtboardsTest = (input?: Dynamic): Dynamic =>
      ClipboardArtboardsDataTextPattern.test(input);
    ClipboardArtboardsDataFontPattern =
      /^data:font\/(?:woff2?|ttf|otf);base64,[A-Za-z0-9+/=\s]*$/i;
    ClipboardArtboardsDataFontPattern_2 = /^data:font\//i;
    ClipboardArtboardsTest_2 = (input?: Dynamic): Dynamic =>
      ClipboardArtboardsDataFontPattern.test(input);
    ClipboardArtboardsLimit_2 = 24;
    ClipboardArtboardsConstant = 24;
    ClipboardArtboardsTest_3 = (input?: Dynamic): Dynamic =>
      ClipboardArtboardsDataImagePattern.test(input) ||
      ClipboardArtboardsDataTextPattern.test(input) ||
      ClipboardArtboardsDataFontPattern.test(input);
    ClipboardArtboardsConstant_2 = 24;
    ClipboardArtboardsReplace = (input?: Dynamic): Dynamic =>
      input.replace(/\.(?:d\.ts|css|m?js)$/i, "");
    ClipboardArtboardsTest_4 = (items?: Dynamic): Dynamic =>
      typeof items == "string" &&
      (((0, runtime.isProjectTextFilePath)(items) &&
        /\.(?:css|m?js)$/i.test(items)) ||
        (0, runtime.isTypeDeclarationPath)(items)) &&
      items.length <= runtime.PlatformFileContentLimit_8 - 16 &&
      !/^(?:artifact-type|project)\//i.test(items) &&
      !runtime.ClipboardFileTransferSubscribers.has(
        (items.split("/").pop() ?? items).toLowerCase(),
      );
    ClipboardArtboardsAZaZPattern = /^[A-Za-z0-9+/=\s]*$/;
    ClipboardArtboardsConstant_3 = 80;
    ClipboardArtboardsConstant_4 = 1e6;
    ClipboardArtboardsBlobPattern = /_blob\/([0-9a-f]{32})(?![0-9a-f])/g;
    ClipboardArtboardsBlobHttpsPattern =
      /blob:https?:\/\/[A-Za-z0-9.:-]{1,80}\/[0-9a-f-]{36}/g;
    ClipboardArtboardsReplace_2 = (input?: Dynamic): Dynamic =>
      input.replace(/\.dc\.html$/, "");
    artboardBaseName = (input?: Dynamic): Dynamic =>
      ClipboardArtboardsReplace_2(input.split("/").pop() ?? input);
    fileBaseName = (input?: Dynamic): Dynamic =>
      input.split("/").pop() ?? input;
    clipboardSourceStrings = (input?: Dynamic): Dynamic => [
      ...input.artboards.map((input2?: Dynamic): Dynamic => input2.src),
      ...Object.entries(input.carried)
        .filter(
          ([input2]: Dynamic): Dynamic =>
            (0, runtime.isProjectSourcePath)(input2),
        )
        .map(([, input2]: Dynamic): Dynamic => input2),
    ];
    ClipboardArtboardsTextEncoder = new TextEncoder();
    ClipboardArtboardsEncode = (items?: Dynamic): Dynamic =>
      items.length <= runtime.PlatformFileContentResolvedValue_11 &&
      (items.length * 3 <= runtime.PlatformFileContentResolvedValue_11 ||
        ClipboardArtboardsTextEncoder.encode(items).length <=
          runtime.PlatformFileContentResolvedValue_11);
    ClipboardArtboardsMax = (input?: Dynamic, options: Dynamic = 0): Dynamic =>
      typeof input == "number" && Number.isFinite(input)
        ? Math.max(options, Math.min(ClipboardArtboardsConstant_4, input))
        : 0;
  };
}
