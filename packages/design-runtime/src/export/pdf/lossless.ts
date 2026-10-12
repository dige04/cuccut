/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfLossless(runtime: RuntimeBindings): () => void {
  function deflateSizeBound(input?: Dynamic): Dynamic {
    return (
      input +
      Math.floor(input / 4096) +
      Math.floor(input / 16384) +
      Math.floor(input / 33554432) +
      13
    );
  }
  function validateLosslessPicture(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (typeof input != "object" || input === null)
      throw new Error("its lossless picture is not an object");
    if (
      !Number.isInteger(input.width) ||
      !Number.isInteger(input.height) ||
      input.width !== options.width ||
      input.height !== options.height
    )
      throw new Error(
        "its lossless picture is " +
          String(input.width) +
          "\xD7" +
          String(input.height) +
          " pixels but its JPEG is " +
          String(options.width) +
          "\xD7" +
          String(options.height),
      );
    let zlib: Dynamic = input.zlib;
    if (
      Object.prototype.toString.call(zlib) !== "[object Uint8Array]" ||
      zlib.length < 8 ||
      zlib.length > deflateSizeBound(input.width * input.height * 3) ||
      (zlib[0] & 15) !== 8 ||
      zlib[0] >> 4 > 7 ||
      ((zlib[0] << 8) | zlib[1]) % 31 !== 0 ||
      (zlib[1] & 32) !== 0
    )
      throw new Error(
        "its lossless picture is not a zlib stream of its pixels",
      );
  }
  bindRuntimeValue(runtime, "deflateSizeBound", () => deflateSizeBound);
  bindRuntimeValue(
    runtime,
    "validateLosslessPicture",
    () => validateLosslessPicture,
  );
  return () => {};
}
