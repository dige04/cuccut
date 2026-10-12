/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssGrid(runtime: RuntimeBindings): () => void {
  function splitGridTracks(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      index: Dynamic = 0,
      text: Dynamic = "";
    for (let value of input as Dynamic) {
      value === "("
        ? index++
        : value === ")" && (index = Math.max(0, index - 1));
      index === 0 && /\s/.test(value)
        ? (text && items.push(text), (text = ""))
        : (text += value);
    }
    text && items.push(text);
    return items;
  }
  function parseEqualGridColumns(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim();
    if (!value || /^none$/i.test(value)) return null;
    let value2: Dynamic =
      /^repeat\(\s*(\d{1,3})\s*,\s*(?:minmax\(\s*0(?:px)?\s*,\s*1fr\s*\)|1fr)\s*\)$/i.exec(
        value,
      );
    if (value2) {
      let value6: Dynamic = parseInt(value2[1], 10);
      return value6 >= 1 ? value6 : null;
    }
    let value3: Dynamic = splitGridTracks(value);
    if (value3.length === 0) return null;
    let callback: Dynamic = (input2?: Dynamic): Dynamic => input2.toLowerCase(),
      value4: Dynamic = callback(value3[0]),
      value5: Dynamic = value4.replace(/\s+/g, "");
    return /^(?:minmax\(0(?:px)?,1fr\)|[\d.]+(?:px|fr|%|em|rem))$/.test(
      value5,
    ) &&
      value3.every((input2?: Dynamic): Dynamic => callback(input2) === value4)
      ? value3.length
      : null;
  }
  function serializeEqualGridColumns(input?: Dynamic): Dynamic {
    return `repeat(${Math.max(1, Math.round(input))}, minmax(0, 1fr))`;
  }
  bindRuntimeValue(runtime, "splitGridTracks", () => splitGridTracks);
  bindRuntimeValue(
    runtime,
    "parseEqualGridColumns",
    () => parseEqualGridColumns,
  );
  bindRuntimeValue(
    runtime,
    "serializeEqualGridColumns",
    () => serializeEqualGridColumns,
  );
  return () => {};
}
