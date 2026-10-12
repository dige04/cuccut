/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCodeUnifiedDiff(
  runtime: RuntimeBindings,
): () => void {
  function utf16SafeSlice(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = context === undefined ? 0 : options,
      value2: Dynamic = context === undefined ? options : context;
    if (value2 >= items.length) return items.slice(value);
    if (value2 <= 0) return "";
    let value3: Dynamic = items.charCodeAt(value2 - 1);
    value3 >= 55296 && value3 <= 56319 && value2--;
    return items.slice(value, value2);
  }
  function diffLines(items?: Dynamic, items2?: Dynamic): Dynamic {
    let length: Dynamic = items.length,
      length2: Dynamic = items2.length,
      value: Dynamic = length + length2,
      value2: Dynamic = value,
      value3: Dynamic = new Int32Array(2 * value + 1),
      items3: Dynamic = [],
      value4: Dynamic = -1;
    e: for (let index: Dynamic = 0; index <= value; index++) {
      items3.push(value3.slice());
      for (let value7: Dynamic = -index; value7 <= index; value7 += 2) {
        let value8: Dynamic =
            value7 === -index ||
            (value7 !== index &&
              value3[value2 + value7 - 1] < value3[value2 + value7 + 1])
              ? value3[value2 + value7 + 1]
              : value3[value2 + value7 - 1] + 1,
          value9: Dynamic = value8 - value7;
        for (
          ;
          value8 < length &&
          value9 < length2 &&
          items[value8] === items2[value9];

        ) {
          value8++;
          value9++;
        }
        value3[value2 + value7] = value8;
        if (value8 >= length && value9 >= length2) {
          value4 = index;
          break e;
        }
      }
    }
    let items4: Dynamic = [],
      value5: Dynamic = length,
      value6: Dynamic = length2;
    for (let value7: Dynamic = value4; value7 > 0; value7--) {
      let value8: Dynamic = items3[value7],
        value9: Dynamic = value5 - value6,
        value10: Dynamic =
          value9 === -value7 ||
          (value9 !== value7 &&
            value8[value2 + value9 - 1] < value8[value2 + value9 + 1]),
        value11: Dynamic = value10 ? value9 + 1 : value9 - 1,
        value12: Dynamic = value8[value2 + value11],
        value13: Dynamic = value12 - value11;
      for (; value5 > value12 && value6 > value13; ) {
        items4.push({
          tag: " ",
          line: items[--value5],
        });
        value6--;
      }
      value10
        ? items4.push({
            tag: "+",
            line: items2[--value6],
          })
        : items4.push({
            tag: "-",
            line: items[--value5],
          });
    }
    for (; value5 > 0 && value6 > 0; ) {
      items4.push({
        tag: " ",
        line: items[--value5],
      });
      value6--;
    }
    for (; value5 > 0; )
      items4.push({
        tag: "-",
        line: items[--value5],
      });
    for (; value6 > 0; )
      items4.push({
        tag: "+",
        line: items2[--value6],
      });
    items4.reverse();
    return items4;
  }
  function formatUnifiedDiff(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = 5,
    value: Dynamic = 2e4,
    extra: Dynamic = false,
  ): Dynamic {
    if (input === options) return "";
    let value2: Dynamic = diffLines(
        input.split(`
`),
        options.split(`
`),
      ),
      value3: Dynamic = new Uint8Array(value2.length);
    for (let index3: Dynamic = 0; index3 < value2.length; index3++)
      value2[index3].tag !== " " && (value3[index3] = 1);
    if (!value3.some(Boolean)) return "";
    for (let index3: Dynamic = 0; index3 < value2.length; index3++)
      if (value2[index3].tag !== " ")
        for (
          let value5: Dynamic = Math.max(0, index3 - context);
          value5 <= Math.min(value2.length - 1, index3 + context);
          value5++
        )
          value3[value5] = 1;
    let items: Dynamic = [],
      items2: Dynamic = [],
      count: Dynamic = 1,
      count2: Dynamic = 1;
    for (let value5 of value2 as Dynamic) {
      items.push(count);
      items2.push(count2);
      value5.tag !== "+" && count++;
      value5.tag !== "-" && count2++;
    }
    let items3: Dynamic = [],
      flag: Dynamic = false,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let index3: Dynamic = 0,
          index4: Dynamic = 0;
        for (let value5: Dynamic = index; value5 <= input2; value5++) {
          value2[value5].tag !== "+" && index3++;
          value2[value5].tag !== "-" && index4++;
        }
        items3.splice(
          index2,
          0,
          `@@ -${items[index]},${index3} +${items2[index]},${index4} @@`,
        );
      };
    for (let index3: Dynamic = 0; index3 < value2.length; index3++) {
      if (!value3[index3]) {
        flag &&
          (extra ? callback(index3 - 1) : items3.push("  \u2026"),
          (flag = false));
        continue;
      }
      flag ||
        (extra && items3.length > 0 && items3.push(""),
        (index = index3),
        (index2 = items3.length));
      flag = true;
      items3.push(value2[index3].tag + " " + value2[index3].line);
    }
    flag && extra && callback(value2.length - 1);
    let value4: Dynamic = items3.join(`
`);
    value4.length > value &&
      (value4 =
        utf16SafeSlice(value4, value - 15) +
        `
\u2026 (truncated)`);
    return value4;
  }
  bindRuntimeValue(runtime, "utf16SafeSlice", () => utf16SafeSlice);
  bindRuntimeValue(runtime, "diffLines", () => diffLines);
  bindRuntimeValue(runtime, "formatUnifiedDiff", () => formatUnifiedDiff);
  return () => {};
}
