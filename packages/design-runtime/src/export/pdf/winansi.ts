/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfWinansi(runtime: RuntimeBindings): () => void {
  var winAnsiCodepointMap: Dynamic;
  var helveticaCharacterWidths: Dynamic;
  function codepointToWinAnsi(input?: Dynamic): Dynamic {
    return (input >= 32 && input <= 126) || (input >= 160 && input <= 255)
      ? input
      : winAnsiCodepointMap[input];
  }
  function winAnsiGlyphWidth(input?: Dynamic): Dynamic {
    return input >= 32 && input <= 126
      ? helveticaCharacterWidths[input - 32]
      : 556;
  }
  function encodeWinAnsiText(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      flag: Dynamic = false;
    for (let value of input as Dynamic) {
      let value2: Dynamic = value.codePointAt(0),
        value3: Dynamic = codepointToWinAnsi(value2);
      value3 === undefined
        ? items.push(32)
        : (items.push(value3), value3 !== 32 && (flag = true));
    }
    return flag ? items : undefined;
  }
  function escapePdfLiteralBytes(input?: Dynamic): Dynamic {
    let text: Dynamic = "";
    for (let value of input as Dynamic)
      value === 92
        ? (text += "\\\\")
        : value === 40
          ? (text += "\\(")
          : value === 41
            ? (text += "\\)")
            : value >= 32 && value <= 126
              ? (text += String.fromCharCode(value))
              : (text += "\\" + value.toString(8).padStart(3, "0"));
    return text;
  }
  bindRuntimeValue(runtime, "codepointToWinAnsi", () => codepointToWinAnsi);
  bindRuntimeValue(
    runtime,
    "winAnsiCodepointMap",
    () => winAnsiCodepointMap,
    (value) => {
      winAnsiCodepointMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "helveticaCharacterWidths",
    () => helveticaCharacterWidths,
    (value) => {
      helveticaCharacterWidths = value;
    },
  );
  bindRuntimeValue(runtime, "winAnsiGlyphWidth", () => winAnsiGlyphWidth);
  bindRuntimeValue(runtime, "encodeWinAnsiText", () => encodeWinAnsiText);
  bindRuntimeValue(
    runtime,
    "escapePdfLiteralBytes",
    () => escapePdfLiteralBytes,
  );
  return () => {
    winAnsiCodepointMap = {
      8364: 128,
      8218: 130,
      402: 131,
      8222: 132,
      8230: 133,
      8224: 134,
      8225: 135,
      710: 136,
      8240: 137,
      352: 138,
      8249: 139,
      338: 140,
      381: 142,
      8216: 145,
      8217: 146,
      8220: 147,
      8221: 148,
      8226: 149,
      8211: 150,
      8212: 151,
      732: 152,
      8482: 153,
      353: 154,
      8250: 155,
      339: 156,
      382: 158,
      376: 159,
    };
    helveticaCharacterWidths = [
      278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
      278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
      584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667,
      556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
      278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222,
      222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500,
      500, 500, 334, 260, 334, 584,
    ];
  };
}
