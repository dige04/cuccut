import type { OwnedBytes } from "../contracts/export";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installExportCompressionIntegrity(
  runtime: RuntimeBindings,
): () => void {
  var exportIntegrityHashAlgorithms: Readonly<
    Record<string, string | undefined>
  >;
  async function gzipExportAsset(bytes: OwnedBytes): Promise<OwnedBytes> {
    let value = new CompressionStream("gzip"),
      value2 = value.writable.getWriter();
    value2.write(bytes);
    value2.close();
    let value3 = value.readable.getReader(),
      items: OwnedBytes[] = [],
      index = 0;
    for (;;) {
      const {
        done: value5,
        value: value6,
      }: ReadableStreamReadResult<OwnedBytes> = await value3.read();
      if (value5) break;
      items.push(value6);
      index += value6.length;
    }
    let value4 = new Uint8Array(index),
      index2 = 0;
    for (let value5 of items) {
      value4.set(value5, index2);
      index2 += value5.length;
    }
    return value4;
  }
  async function verifyExportAssetIntegrity(
    bytes: OwnedBytes,
    integrity: string,
  ): Promise<boolean> {
    let value = integrity.indexOf("-"),
      value2 = exportIntegrityHashAlgorithms[integrity.slice(0, value)];
    if (!value2) return false;
    let value3 = await crypto.subtle.digest(value2, bytes);
    return (
      (0, runtime.encodeBinaryBase64)(new Uint8Array(value3)) ===
      integrity.slice(value + 1)
    );
  }
  bindRuntimeValue(runtime, "gzipExportAsset", () => gzipExportAsset);
  bindRuntimeValue(
    runtime,
    "exportIntegrityHashAlgorithms",
    () => exportIntegrityHashAlgorithms,
    (value) => {
      exportIntegrityHashAlgorithms = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "verifyExportAssetIntegrity",
    () => verifyExportAssetIntegrity,
  );
  return () => {
    exportIntegrityHashAlgorithms = {
      sha256: "SHA-256",
      sha384: "SHA-384",
      sha512: "SHA-512",
    };
  };
}
