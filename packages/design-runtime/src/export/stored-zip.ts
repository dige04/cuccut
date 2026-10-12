import type { StoredZipEntry, OwnedBytes } from "../contracts/export";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installExportStoredZip(runtime: RuntimeBindings): () => void {
  var zipCrc32Table: Uint32Array;
  function zipCrc32(bytes: Uint8Array): number {
    let count = 4294967295;
    for (let index = 0; index < bytes.length; index++)
      count = zipCrc32Table[(count ^ bytes[index]!) & 255]! ^ (count >>> 8);
    return (count ^ 4294967295) >>> 0;
  }
  function createStoredZip(entries: readonly StoredZipEntry[]): Blob {
    let encoder = new TextEncoder(),
      localFileParts: OwnedBytes[] = [],
      centralDirectoryParts: OwnedBytes[] = [],
      archiveOffset = 0,
      timestamp = new Date(),
      dosTime =
        (timestamp.getHours() << 11) |
        (timestamp.getMinutes() << 5) |
        (timestamp.getSeconds() >> 1),
      dosDate =
        ((timestamp.getFullYear() - 1980) << 9) |
        ((timestamp.getMonth() + 1) << 5) |
        timestamp.getDate();
    for (let value3 of entries) {
      let value4 = encoder.encode(value3.name),
        value5 =
          typeof value3.data == "string"
            ? encoder.encode(value3.data)
            : value3.data,
        value6 = zipCrc32(value5),
        value7 = new DataView(new ArrayBuffer(30));
      value7.setUint32(0, 67324752, true);
      value7.setUint16(4, 20, true);
      value7.setUint16(6, 2048, true);
      value7.setUint16(8, 0, true);
      value7.setUint16(10, dosTime, true);
      value7.setUint16(12, dosDate, true);
      value7.setUint32(14, value6, true);
      value7.setUint32(18, value5.length, true);
      value7.setUint32(22, value5.length, true);
      value7.setUint16(26, value4.length, true);
      value7.setUint16(28, 0, true);
      localFileParts.push(new Uint8Array(value7.buffer), value4, value5);
      let value8 = new DataView(new ArrayBuffer(46));
      value8.setUint32(0, 33639248, true);
      value8.setUint16(4, 20, true);
      value8.setUint16(6, 20, true);
      value8.setUint16(8, 2048, true);
      value8.setUint16(10, 0, true);
      value8.setUint16(12, dosTime, true);
      value8.setUint16(14, dosDate, true);
      value8.setUint32(16, value6, true);
      value8.setUint32(20, value5.length, true);
      value8.setUint32(24, value5.length, true);
      value8.setUint16(28, value4.length, true);
      value8.setUint16(30, 0, true);
      value8.setUint16(32, 0, true);
      value8.setUint16(34, 0, true);
      value8.setUint16(36, 0, true);
      value8.setUint32(38, 0, true);
      value8.setUint32(42, archiveOffset, true);
      centralDirectoryParts.push(new Uint8Array(value8.buffer), value4);
      archiveOffset += 30 + value4.length + value5.length;
    }
    let value = centralDirectoryParts.reduce(
        (input, items) => input + items.length,
        0,
      ),
      value2 = new DataView(new ArrayBuffer(22));
    value2.setUint32(0, 101010256, true);
    value2.setUint16(4, 0, true);
    value2.setUint16(6, 0, true);
    value2.setUint16(8, entries.length, true);
    value2.setUint16(10, entries.length, true);
    value2.setUint32(12, value, true);
    value2.setUint32(16, archiveOffset, true);
    value2.setUint16(20, 0, true);
    return new Blob(
      [
        ...localFileParts,
        ...centralDirectoryParts,
        new Uint8Array(value2.buffer),
      ],
      {
        type: "application/zip",
      },
    );
  }
  bindRuntimeValue(
    runtime,
    "zipCrc32Table",
    () => zipCrc32Table,
    (value) => {
      zipCrc32Table = value;
    },
  );
  bindRuntimeValue(runtime, "zipCrc32", () => zipCrc32);
  bindRuntimeValue(runtime, "createStoredZip", () => createStoredZip);
  return () => {
    zipCrc32Table = ((): Dynamic => {
      let value: Dynamic = new Uint32Array(256);
      for (let index: Dynamic = 0; index < 256; index++) {
        let value2: Dynamic = index;
        for (let index2: Dynamic = 0; index2 < 8; index2++)
          value2 = value2 & 1 ? 3988292384 ^ (value2 >>> 1) : value2 >>> 1;
        value[index] = value2 >>> 0;
      }
      return value;
    })();
  };
}
