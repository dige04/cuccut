/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfJpeg(runtime: RuntimeBindings): () => void {
  function pixelsToPoints(input?: Dynamic): Dynamic {
    return (input * 72) / 96;
  }
  function decodeJpegDataUrl(input?: Dynamic): Dynamic {
    let text: Dynamic = "data:image/jpeg;base64,";
    if (input.startsWith(text))
      try {
        return decodeBase64Bytes(input.slice(text.length));
      } catch {
        return;
      }
  }
  function decodeBase64Bytes(base64?: Dynamic): Dynamic {
    let binary: Dynamic = atob(base64),
      bytes: Dynamic = new Uint8Array(binary.length);
    for (let index: Dynamic = 0; index < binary.length; index++)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  function readJpegDimensions(items?: Dynamic): Dynamic {
    if (items.length < 4 || items[0] !== 255 || items[1] !== 216)
      throw new Error("not a JPEG image (missing SOI marker)");
    let count: Dynamic = 2;
    for (;;) {
      if (count + 1 >= items.length)
        throw new Error("not a valid JPEG image (no frame header found)");
      if (items[count] !== 255)
        throw new Error("not a valid JPEG image (corrupt marker stream)");
      let value: Dynamic = count + 1;
      for (; value < items.length && items[value] === 255; ) value++;
      if (value >= items.length)
        throw new Error("not a valid JPEG image (truncated)");
      let value2: Dynamic = items[value];
      if (value2 === 1 || (value2 >= 208 && value2 <= 215)) {
        count = value + 1;
        continue;
      }
      if (value2 === 217 || value2 === 218)
        throw new Error("not a valid JPEG image (no frame header found)");
      if (count + 3 >= items.length || value + 2 >= items.length)
        throw new Error("not a valid JPEG image (truncated)");
      let value3: Dynamic = (items[value + 1] << 8) | items[value + 2];
      if (value3 < 2 || value + 1 + value3 > items.length)
        throw new Error("not a valid JPEG image (truncated segment)");
      if (value2 === 192 || value2 === 193 || value2 === 194) {
        if (value3 < 8)
          throw new Error("not a valid JPEG image (bad frame header)");
        let value4: Dynamic = items[value + 3],
          value5: Dynamic = (items[value + 4] << 8) | items[value + 5],
          value6: Dynamic = (items[value + 6] << 8) | items[value + 7],
          value7: Dynamic = items[value + 8];
        if (value4 !== 8)
          throw new Error("unsupported JPEG (only 8-bit precision embeds)");
        if (value6 === 0 || value5 === 0)
          throw new Error("not a valid JPEG image (zero size)");
        if (value7 !== 1 && value7 !== 3)
          throw new Error(
            "unsupported JPEG color layout (" +
              String(value7) +
              " components \u2014 only grayscale and RGB embed)",
          );
        return {
          width: value6,
          height: value5,
          components: value7,
        };
      }
      if (
        value2 >= 195 &&
        value2 <= 207 &&
        value2 !== 196 &&
        value2 !== 200 &&
        value2 !== 204
      )
        throw new Error(
          "unsupported JPEG variant (not baseline or progressive)",
        );
      count = value + 1 + value3;
    }
  }
  bindRuntimeValue(runtime, "pixelsToPoints", () => pixelsToPoints);
  bindRuntimeValue(runtime, "decodeJpegDataUrl", () => decodeJpegDataUrl);
  bindRuntimeValue(runtime, "decodeBase64Bytes", () => decodeBase64Bytes);
  bindRuntimeValue(runtime, "readJpegDimensions", () => readJpegDimensions);
  return () => {};
}
