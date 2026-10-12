/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPlatformSha256(runtime: RuntimeBindings): () => void {
  var sha256RoundConstants: Uint32Array;
  var PlatformSha256TextEncoder: TextEncoder;
  var PlatformSha256Encode: (text: string) => Uint8Array<ArrayBuffer>;
  function sha256Fallback(input: string | Uint8Array): string {
    let value = typeof input == "string" ? PlatformSha256Encode(input) : input,
      length = value.length,
      value2 = ((length + 9 + 63) >> 6) << 6,
      value3 = new Uint8Array(value2);
    value3.set(value);
    value3[length] = 128;
    let value4 = new DataView(value3.buffer);
    value4.setUint32(value2 - 8, Math.floor(length / 536870912), false);
    value4.setUint32(value2 - 4, (length << 3) >>> 0, false);
    let value5 = new Uint32Array([
        1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
        528734635, 1541459225,
      ]),
      value6 = new Uint32Array(64);
    for (let index = 0; index < value2; index += 64) {
      for (let index2 = 0; index2 < 16; index2++)
        value6[index2] = value4.getUint32(index + index2 * 4, false);
      for (let count = 16; count < 64; count++) {
        let value15 = value6[count - 15]!,
          value16 = value6[count - 2]!,
          value17 =
            ((value15 >>> 7) | (value15 << 25)) ^
            ((value15 >>> 18) | (value15 << 14)) ^
            (value15 >>> 3),
          value18 =
            ((value16 >>> 17) | (value16 << 15)) ^
            ((value16 >>> 19) | (value16 << 13)) ^
            (value16 >>> 10);
        value6[count] =
          (value6[count - 16]! + value17 + value6[count - 7]! + value18) | 0;
      }
      let value7 = value5[0]!,
        value8 = value5[1]!,
        value9 = value5[2]!,
        value10 = value5[3]!,
        value11 = value5[4]!,
        value12 = value5[5]!,
        value13 = value5[6]!,
        value14 = value5[7]!;
      for (let index2 = 0; index2 < 64; index2++) {
        let value15 =
            ((value11 >>> 6) | (value11 << 26)) ^
            ((value11 >>> 11) | (value11 << 21)) ^
            ((value11 >>> 25) | (value11 << 7)),
          value16 = (value11 & value12) ^ (~value11 & value13),
          value17 =
            (value14 +
              value15 +
              value16 +
              sha256RoundConstants[index2]! +
              value6[index2]!) |
            0,
          value18 =
            ((value7 >>> 2) | (value7 << 30)) ^
            ((value7 >>> 13) | (value7 << 19)) ^
            ((value7 >>> 22) | (value7 << 10)),
          value19 = (value7 & value8) ^ (value7 & value9) ^ (value8 & value9),
          value20 = (value18 + value19) | 0;
        value14 = value13;
        value13 = value12;
        value12 = value11;
        value11 = (value10 + value17) | 0;
        value10 = value9;
        value9 = value8;
        value8 = value7;
        value7 = (value17 + value20) | 0;
      }
      value5[0] = (value5[0]! + value7) | 0;
      value5[1] = (value5[1]! + value8) | 0;
      value5[2] = (value5[2]! + value9) | 0;
      value5[3] = (value5[3]! + value10) | 0;
      value5[4] = (value5[4]! + value11) | 0;
      value5[5] = (value5[5]! + value12) | 0;
      value5[6] = (value5[6]! + value13) | 0;
      value5[7] = (value5[7]! + value14) | 0;
    }
    let text = "";
    for (let index = 0; index < 8; index++)
      text += (value5[index]! >>> 0).toString(16).padStart(8, "0");
    return text;
  }
  async function sha256(
    input: string | Uint8Array<ArrayBuffer>,
  ): Promise<string> {
    let value = typeof input == "string" ? PlatformSha256Encode(input) : input,
      value2 = globalThis.crypto?.subtle;
    if (typeof value2?.digest == "function" && value.length > 4096)
      try {
        let value3 = new Uint8Array(await value2.digest("SHA-256", value)),
          text = "";
        for (let value4 of value3) text += value4.toString(16).padStart(2, "0");
        return text;
      } catch {}
    return sha256Fallback(value);
  }
  bindRuntimeValue(
    runtime,
    "sha256RoundConstants",
    () => sha256RoundConstants,
    (value) => {
      sha256RoundConstants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformSha256TextEncoder",
    () => PlatformSha256TextEncoder,
    (value) => {
      PlatformSha256TextEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformSha256Encode",
    () => PlatformSha256Encode,
    (value) => {
      PlatformSha256Encode = value;
    },
  );
  bindRuntimeValue(runtime, "sha256Fallback", () => sha256Fallback);
  bindRuntimeValue(runtime, "sha256", () => sha256);
  return () => {
    sha256RoundConstants = new Uint32Array([
      1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
      2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
      1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
      264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
      2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
      113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
      1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
      3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
      430227734, 506948616, 659060556, 883997877, 958139571, 1322822218,
      1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424,
      2428436474, 2756734187, 3204031479, 3329325298,
    ]);
    PlatformSha256TextEncoder = new TextEncoder();
    PlatformSha256Encode = (input?: Dynamic): Dynamic =>
      PlatformSha256TextEncoder.encode(input);
  };
}
