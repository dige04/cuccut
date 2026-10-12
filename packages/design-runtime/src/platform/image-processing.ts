/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformImageProcessing(
  runtime: RuntimeBindings,
): () => void {
  var PlatformImageProcessingItems: Dynamic;
  var PlatformImageProcessingConstant: Dynamic;
  var PlatformImageProcessingLimit: Dynamic;
  var PlatformImageProcessingItems_2: Dynamic;
  function isSvgMimeType(input?: Dynamic): Dynamic {
    return (input.split(";")[0] ?? "").trim().toLowerCase() === "image/svg+xml";
  }
  async function rasterizeSvg(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = URL.createObjectURL(input);
    try {
      let value2: Dynamic = new Image();
      await new Promise((input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value11: Dynamic = setTimeout(
          (): Dynamic => options2(new Error("timed out reading the SVG")),
          2e4,
        );
        value2.onload = (): Dynamic => {
          clearTimeout(value11);
          input2();
        };
        value2.onerror = (): Dynamic => {
          clearTimeout(value11);
          options2(new Error("the SVG could not be decoded as an image"));
        };
        value2.src = value;
      });
      let value3: Dynamic = value2.naturalWidth > 0 && value2.naturalHeight > 0,
        value4: Dynamic = value3 ? value2.naturalWidth : options,
        value5: Dynamic = value3 ? value2.naturalHeight : options,
        value6: Dynamic = options / Math.max(value4, value5),
        value7: Dynamic = Math.max(1, Math.round(value4 * value6)),
        value8: Dynamic = Math.max(1, Math.round(value5 * value6)),
        value9: Dynamic = (document as Dynamic).createElement("canvas");
      value9.width = value7;
      value9.height = value8;
      let value10: Dynamic = value9.getContext("2d");
      if (value10 === null) throw new Error("no 2d canvas in this host");
      value10.drawImage(value2, 0, 0, value7, value8);
      try {
        value10.getImageData(0, 0, 1, 1);
      } catch {
        throw new Error(
          "this SVG uses features that can't be imported (embedded web content)",
        );
      }
      return createImageBitmap(value9);
    } finally {
      URL.revokeObjectURL(value);
    }
  }
  async function decodeImageBlob(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    return isSvgMimeType(input.type)
      ? rasterizeSvg(input, options)
      : createImageBitmap(input);
  }
  function encodeDownsampledImage(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = Math.min(
        1,
        options / Math.max(input.width, input.height),
      ),
      value3: Dynamic = Math.max(1, Math.round(input.width * value2)),
      value4: Dynamic = Math.max(1, Math.round(input.height * value2)),
      value5: Dynamic = (document as Dynamic).createElement("canvas");
    value5.width = value3;
    value5.height = value4;
    let value6: Dynamic = value5.getContext("2d");
    if (!value6) return;
    value6.drawImage(input, 0, 0, value3, value4);
    let value7: Dynamic = value5.toDataURL(value, context);
    return value7.startsWith("data:" + value) ? value7 : undefined;
  }
  async function downsampleImageToDataUrl(
    input?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic = options.maxBytes ?? 71680,
      value2: Dynamic = options.maxEdge ?? 1280,
      value3: Dynamic = await decodeImageBlob(
        input,
        Math.max(PlatformImageProcessingLimit, value2),
      );
    try {
      let value4: Dynamic = Math.max(
          PlatformImageProcessingLimit,
          Math.min(value2, Math.max(value3.width, value3.height)),
        ),
        value5: Dynamic;
      for (; value4 >= PlatformImageProcessingLimit; ) {
        for (let value6 of PlatformImageProcessingItems as Dynamic) {
          let value7: Dynamic =
            encodeDownsampledImage(value3, value4, value6, "image/webp") ??
            encodeDownsampledImage(value3, value4, value6, "image/jpeg");
          if (value7 && value7.length <= value) return value7;
          value7 &&
            (!value5 || value7.length < value5.length) &&
            (value5 = value7);
        }
        value4 = Math.floor(value4 * PlatformImageProcessingConstant);
      }
      throw new Error(
        "could not fit the image into " +
          String(value) +
          " bytes" +
          (value5 ? " (smallest attempt: " + String(value5.length) + ")" : ""),
      );
    } finally {
      value3.close();
    }
  }
  async function encodeDownsampledBlob(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Promise<Dynamic> {
    let value2: Dynamic = Math.min(
        1,
        options / Math.max(input.width, input.height),
      ),
      value3: Dynamic = Math.max(1, Math.round(input.width * value2)),
      value4: Dynamic = Math.max(1, Math.round(input.height * value2)),
      value5: Dynamic = (document as Dynamic).createElement("canvas");
    value5.width = value3;
    value5.height = value4;
    let value6: Dynamic = value5.getContext("2d");
    if (!value6) return;
    value6.drawImage(input, 0, 0, value3, value4);
    let value7: Dynamic = await new Promise(
      (input2?: Dynamic): Dynamic => value5.toBlob(input2, value, context),
    );
    return value7 !== null && value7.type === value ? value7 : undefined;
  }
  async function downsampleImageBlob(
    input?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic = options.maxEdge ?? 2560,
      value2: Dynamic = options.maxBytes ?? 1.5 * 1024 * 1024,
      value3: Dynamic = await decodeImageBlob(input, value);
    try {
      let value4: Dynamic = Math.max(
        PlatformImageProcessingLimit,
        Math.min(value, Math.max(value3.width, value3.height)),
      );
      for (; value4 >= PlatformImageProcessingLimit; ) {
        for (let value5 of PlatformImageProcessingItems_2 as Dynamic) {
          let value6: Dynamic =
            (await encodeDownsampledBlob(
              value3,
              value4,
              value5,
              "image/webp",
            )) ??
            (await encodeDownsampledBlob(value3, value4, value5, "image/jpeg"));
          if (value6 && value6.size <= value2) return value6;
        }
        value4 = Math.floor(value4 * PlatformImageProcessingConstant);
      }
      throw new Error(
        "could not fit the image into " + String(value2) + " bytes",
      );
    } finally {
      value3.close();
    }
  }
  function isImageFile(input?: Dynamic): Dynamic {
    return input.type.startsWith("image/");
  }
  bindRuntimeValue(
    runtime,
    "PlatformImageProcessingItems",
    () => PlatformImageProcessingItems,
    (value) => {
      PlatformImageProcessingItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformImageProcessingConstant",
    () => PlatformImageProcessingConstant,
    (value) => {
      PlatformImageProcessingConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformImageProcessingLimit",
    () => PlatformImageProcessingLimit,
    (value) => {
      PlatformImageProcessingLimit = value;
    },
  );
  bindRuntimeValue(runtime, "isSvgMimeType", () => isSvgMimeType);
  bindRuntimeValue(runtime, "rasterizeSvg", () => rasterizeSvg);
  bindRuntimeValue(runtime, "decodeImageBlob", () => decodeImageBlob);
  bindRuntimeValue(
    runtime,
    "encodeDownsampledImage",
    () => encodeDownsampledImage,
  );
  bindRuntimeValue(
    runtime,
    "downsampleImageToDataUrl",
    () => downsampleImageToDataUrl,
  );
  bindRuntimeValue(
    runtime,
    "encodeDownsampledBlob",
    () => encodeDownsampledBlob,
  );
  bindRuntimeValue(
    runtime,
    "PlatformImageProcessingItems_2",
    () => PlatformImageProcessingItems_2,
    (value) => {
      PlatformImageProcessingItems_2 = value;
    },
  );
  bindRuntimeValue(runtime, "downsampleImageBlob", () => downsampleImageBlob);
  bindRuntimeValue(runtime, "isImageFile", () => isImageFile);
  return () => {
    PlatformImageProcessingItems = [0.8, 0.65, 0.5, 0.35, 0.25];
    PlatformImageProcessingConstant = 0.7;
    PlatformImageProcessingLimit = 64;
    PlatformImageProcessingItems_2 = [0.85, 0.75, 0.65, 0.5];
  };
}
