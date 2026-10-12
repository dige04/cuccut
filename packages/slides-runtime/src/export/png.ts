/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    pngCrc32: (bytes: Uint8Array) => number;
    pngChunk: (type: string, bytes: Uint8Array) => Uint8Array;
    rgbPixelsToPngDataUrl: (
      rgba: ArrayLike<number>,
      width: number,
      height: number,
    ) => Promise<Uint8Array | undefined>;
    pngBytesToDataUrl: (bytes: Uint8Array) => string;
    pngSignature: number[];
    pngCrc32Table: Uint32Array;
    initializePngEncoding: () => void;
  }
}

export function installExportPng(runtime: RuntimeBindings): () => void {
  var pngSignature: RuntimeBindings["pngSignature"];
  var pngCrc32Table: RuntimeBindings["pngCrc32Table"];
  var initializePngEncoding: RuntimeBindings["initializePngEncoding"];
  function pngCrc32(bytes: Uint8Array): number {
    let count: number = 4294967295;
    for (let value of bytes)
      count = pngCrc32Table[(count ^ value) & 255]! ^ (count >>> 8);
    return (count ^ 4294967295) >>> 0;
  }
  function pngChunk(type: string, bytes: Uint8Array): Uint8Array {
    let chunk = new Uint8Array(12 + bytes.length),
      view = new DataView(chunk.buffer);
    view.setUint32(0, bytes.length);
    for (let index = 0; index < 4; index++)
      chunk[4 + index] = type.charCodeAt(index);
    chunk.set(bytes, 8);
    view.setUint32(
      8 + bytes.length,
      pngCrc32(chunk.subarray(4, 8 + bytes.length)),
    );
    return chunk;
  }
  async function rgbPixelsToPngDataUrl(
    rgba: ArrayLike<number>,
    width: number,
    height: number,
  ): Promise<Uint8Array | undefined> {
    if (typeof CompressionStream !== "function") {
      return;
    }
    let rowBytes = 1 + width * 3,
      filteredPixels = new Uint8Array(rowBytes * height);
    for (let index2 = 0; index2 < height; index2++) {
      filteredPixels[index2 * rowBytes] = 1;
      for (let index3 = 0; index3 < width; index3++)
        for (let index4 = 0; index4 < 3; index4++) {
          let value5 = (index2 * width + index3) * 4 + index4;
          filteredPixels[index2 * rowBytes + 1 + index3 * 3 + index4] =
            rgba[value5]! - (index3 > 0 ? rgba[value5 - 4]! : 0);
        }
    }
    let value = new Uint8Array(
        await new Response(
          new Blob([filteredPixels])
            .stream()
            .pipeThrough(new CompressionStream("deflate")),
        ).arrayBuffer(),
      ),
      value2 = new Uint8Array(13),
      value3 = new DataView(value2.buffer);
    value3.setUint32(0, width);
    value3.setUint32(4, height);
    value2[8] = 8;
    value2[9] = 2;
    let items = [
        Uint8Array.from(pngSignature),
        pngChunk("IHDR", value2),
        pngChunk("IDAT", value),
        pngChunk("IEND", new Uint8Array(0)),
      ],
      value4 = new Uint8Array(
        items.reduce(
          (input: number, items2: Uint8Array): number => input + items2.length,
          0,
        ),
      ),
      index = 0;
    for (let value5 of items) {
      value4.set(value5, index);
      index += value5.length;
    }
    return value4;
  }
  function pngBytesToDataUrl(bytes: Uint8Array): string {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768)
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    return "data:image/png;base64," + btoa(binary);
  }
  bindRuntimeValue(runtime, "pngCrc32", () => pngCrc32);
  bindRuntimeValue(runtime, "pngChunk", () => pngChunk);
  bindRuntimeValue(
    runtime,
    "rgbPixelsToPngDataUrl",
    () => rgbPixelsToPngDataUrl,
  );
  bindRuntimeValue(runtime, "pngBytesToDataUrl", () => pngBytesToDataUrl);
  bindRuntimeValue(
    runtime,
    "pngSignature",
    () => pngSignature,
    (value) => {
      pngSignature = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pngCrc32Table",
    () => pngCrc32Table,
    (value) => {
      pngCrc32Table = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePngEncoding",
    () => initializePngEncoding,
    (value) => {
      initializePngEncoding = value;
    },
  );
  return () => {
    initializePngEncoding = (0, runtime.initializeOnce)((): void => {
      pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
      pngCrc32Table = Uint32Array.from(
        {
          length: 256,
        },
        (input: unknown, options: number): number => {
          let value = options;
          for (let index = 0; index < 8; index++)
            value = value & 1 ? 3988292384 ^ (value >>> 1) : value >>> 1;
          return value >>> 0;
        },
      );
    });
  };
}
