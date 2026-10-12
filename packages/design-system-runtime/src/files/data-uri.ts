/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type { FileData } from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesDataUri(runtime: RuntimeBindings): () => void {
  var BASE64_ALPHABET: string;
  var BASE64_ENCODE_CHUNK_BYTES: number;
  function encodeBytesBase64(bytes: Uint8Array<ArrayBufferLike>) {
    let base64 = "";
    for (
      let index = 0;
      index < bytes.length;
      index += BASE64_ENCODE_CHUNK_BYTES
    ) {
      base64 += btoa(
        String.fromCharCode.apply(
          null,
          bytes.subarray(
            index,
            index + BASE64_ENCODE_CHUNK_BYTES,
          ) as unknown as number[],
        ),
      );
    }
    return base64;
  }
  function decodeBytesBase64(text: string) {
    let base64 = text.replace(/[^A-Za-z0-9+/]/g, ""),
      bytes = new Uint8Array(Math.floor((base64.length * 3) / 4)),
      written: number = 0;
    for (let index = 0; index + 1 < base64.length; index += 4) {
      let value = BASE64_ALPHABET.indexOf(base64[index]),
        value2 = BASE64_ALPHABET.indexOf(base64[index + 1]),
        value3 =
          index + 2 < base64.length
            ? BASE64_ALPHABET.indexOf(base64[index + 2])
            : -1,
        value4 =
          index + 3 < base64.length
            ? BASE64_ALPHABET.indexOf(base64[index + 3])
            : -1;
      bytes[written++] = (value << 2) | (value2 >> 4);
      if (value3 >= 0) {
        bytes[written++] = ((value2 & 15) << 4) | (value3 >> 2);
      }
      if (value4 >= 0) {
        bytes[written++] = ((value3 & 3) << 6) | value4;
      }
    }
    return bytes.subarray(0, written);
  }
  function bytesToFileDataUri(
    bytes: Uint8Array<ArrayBufferLike>,
    mime: string,
  ): string {
    return "data:" + mime + ";base64," + encodeBytesBase64(bytes);
  }
  function decodeHeldFileDataUri(dataUri: string): FileData | null {
    let parsed = (0, runtime.parseDataUriHeader)(dataUri);
    if (parsed === null) {
      return null;
    }
    let payload = dataUri.slice(parsed.payloadOffset);
    if (parsed.base64) {
      return {
        bytes: decodeBytesBase64(payload),
        type: parsed.mime,
      };
    }
    try {
      return {
        bytes: new TextEncoder().encode(decodeURIComponent(payload)),
        type: parsed.mime,
      };
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "BASE64_ALPHABET",
    () => BASE64_ALPHABET,
    (value) => {
      BASE64_ALPHABET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BASE64_ENCODE_CHUNK_BYTES",
    () => BASE64_ENCODE_CHUNK_BYTES,
    (value) => {
      BASE64_ENCODE_CHUNK_BYTES = value;
    },
  );
  bindRuntimeValue(runtime, "encodeBytesBase64", () => encodeBytesBase64);
  bindRuntimeValue(runtime, "decodeBytesBase64", () => decodeBytesBase64);
  bindRuntimeValue(runtime, "bytesToFileDataUri", () => bytesToFileDataUri);
  bindRuntimeValue(
    runtime,
    "decodeHeldFileDataUri",
    () => decodeHeldFileDataUri,
  );
  return () => {
    BASE64_ALPHABET =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    BASE64_ENCODE_CHUNK_BYTES = 24576;
  };
}
