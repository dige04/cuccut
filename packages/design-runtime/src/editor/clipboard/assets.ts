/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardAssets(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardAssetsConstant: Dynamic;
  var ClipboardAssetsHandler: Dynamic;
  var clipboardPayloadUsage: Dynamic;
  async function resolveClipboardPictures(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Promise<Dynamic> {
    let entries: Dynamic = new Map(),
      index: Dynamic = 0;
    for (let value3 of new Set(
      items.map((input?: Dynamic): Dynamic => input.asset),
    ) as Dynamic) {
      let entry: Dynamic = options.get(value3),
        value4: Dynamic =
          entry === undefined
            ? null
            : (0, runtime.dataUrlToBlob)(
                entry,
                "pasted-picture-" + String(entries.size + 1),
              ),
        value5: Dynamic =
          value4 === null
            ? undefined
            : (0, runtime.readRasterImagePixels)(
                new Uint8Array(await value4.arrayBuffer()),
              );
      value4 === null ||
        value5 === undefined ||
        index + value5 > value.maxPixels ||
        ((index += value5), entries.set(value3, value4));
    }
    let entries2: Dynamic = new Map(),
      items2: Dynamic = [...entries],
      callback: Dynamic = (): Dynamic =>
        new Promise(
          (input?: Dynamic): Dynamic =>
            setTimeout(input, value.timeoutMs ?? ClipboardAssetsConstant, null),
        ),
      callback2: Dynamic = async (): Promise<Dynamic> => {
        for (
          let value3: Dynamic = items2.shift();
          value3 !== undefined && !context.aborted;
          value3 = items2.shift()
        ) {
          let [value4, value5]: Dynamic = value3;
          if (
            (await Promise.resolve()
              .then((): Dynamic => value.gate(value5))
              .catch((): Dynamic => "refused")) !== null ||
            context.aborted
          )
            continue;
          let value6: Dynamic = Promise.resolve()
              .then((): Dynamic => value.upload(value5))
              .then(
                (input?: Dynamic): Dynamic =>
                  typeof input?.src == "string" ? input.src : null,
                (): Dynamic => null,
              ),
            value7: Dynamic = await Promise.race([value6, callback()]);
          if (value7 === null) {
            value6
              .then((input?: Dynamic): Dynamic => {
                input?.startsWith("./") && value.discard(input.slice(2));
              })
              .catch((): Dynamic => {});
            continue;
          }
          value7.startsWith("./") && value.stored(value7.slice(2));
          entries2.set(value4, value7);
        }
      };
    await Promise.all(
      Array.from(
        {
          length: Math.min(4, items2.length),
        },
        callback2,
      ),
    );
    let value2: Dynamic = items.flatMap((input?: Dynamic): Dynamic => {
      let entry: Dynamic = entries2.get(input.asset),
        value3: Dynamic =
          entry === undefined
            ? null
            : (0, runtime.replaceClipboardPictureSource)(input, entry);
      return value3 === null ? [] : [value3];
    });
    return {
      landed: value2,
      failed: items.length - value2.length,
    };
  }
  function parseClipboardAssets(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = {
      count: 0,
      chars: 0,
      has: (): Dynamic => false,
    },
  ): Dynamic {
    let entries: Dynamic = new Map(),
      value: Dynamic = input?.assets;
    if (typeof value != "object" || value === null) return entries;
    let { count: value2, chars: value3 }: Dynamic = context;
    for (let { asset: value4 } of options as Dynamic) {
      if (entries.has(value4) || !Object.hasOwn(value, value4)) continue;
      let value5: Dynamic = value[value4];
      if (
        !(
          typeof value5 != "string" ||
          value5.length > runtime.ClipboardArtboardsResolvedValue_2 ||
          !(0, runtime.ClipboardAnnotationsTest_3)(value5)
        )
      ) {
        if (!context.has(value4)) {
          if (
            value2 >= runtime.ClipboardArtboardsLimit ||
            value3 + value5.length > runtime.ClipboardArtboardsResolvedValue
          )
            continue;
          value2++;
          value3 += value5.length;
        }
        entries.set(value4, value5);
      }
    }
    return entries;
  }
  bindRuntimeValue(
    runtime,
    "ClipboardAssetsConstant",
    () => ClipboardAssetsConstant,
    (value) => {
      ClipboardAssetsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAssetsHandler",
    () => ClipboardAssetsHandler,
    (value) => {
      ClipboardAssetsHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveClipboardPictures",
    () => resolveClipboardPictures,
  );
  bindRuntimeValue(
    runtime,
    "clipboardPayloadUsage",
    () => clipboardPayloadUsage,
    (value) => {
      clipboardPayloadUsage = value;
    },
  );
  bindRuntimeValue(runtime, "parseClipboardAssets", () => parseClipboardAssets);
  return () => {
    ClipboardAssetsConstant = 6e4;
    ClipboardAssetsHandler = (input?: Dynamic): Dynamic => input * 2560 * 2560;
    clipboardPayloadUsage = (input?: Dynamic): Dynamic => ({
      count: Object.keys(input.assets).length,
      chars: [
        ...input.artboards.map((input2?: Dynamic): Dynamic => input2.src),
        ...Object.values(input.files),
        ...Object.values(input.assets),
      ].reduce(
        (input2?: Dynamic, items?: Dynamic): Dynamic => input2 + items.length,
        0,
      ),
      has: (input2?: Dynamic): Dynamic => Object.hasOwn(input.assets, input2),
    });
  };
}
