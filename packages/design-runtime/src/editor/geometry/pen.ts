/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorGeometryPen(runtime: RuntimeBindings): () => void {
  function fitPenCurve(input?: Dynamic, options?: Dynamic): Dynamic {
    let items: Dynamic = [],
      items2: Dynamic = [];
    for (let [value3, value4] of input as Dynamic)
      (items.length === 0 ||
        value3 !== items[items.length - 1] ||
        value4 !== items2[items2.length - 1]) &&
        (items.push(value3), items2.push(value4));
    let length: Dynamic = items.length;
    if (length < 2) return null;
    if (length === 2) return [items[0], items2[0], items[1], items2[1]];
    let callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value3: Dynamic = Math.sqrt(input2 * input2 + options2 * options2);
        return value3 > 0 ? [input2 / value3, options2 / value3] : [0, 0];
      },
      items3: Dynamic = [items[0], items2[0]],
      callback2: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value3?: Dynamic,
        extra?: Dynamic,
        detail?: Dynamic,
      ): Dynamic => {
        items3.push(input2, options2, context, value3, extra, detail);
      },
      value: Dynamic = new Array(length).fill(0),
      value2: Dynamic = options * options,
      callback3: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        Math.sqrt(
          (items[input2] - items[options2]) ** 2 +
            (items2[input2] - items2[options2]) ** 2,
        ),
      callback4: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value3: Dynamic = options2 > input2 ? 1 : -1,
          value4: Dynamic = input2 + value3;
        for (; value4 !== options2 && callback3(input2, value4) < 4 * options; )
          value4 += value3;
        return callback(
          items[value4] - items[input2],
          items2[value4] - items2[input2],
        );
      },
      callback5: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value3?: Dynamic,
        extra?: Dynamic,
        detail?: Dynamic,
      ): Dynamic => {
        let value4: Dynamic = items[input2],
          value5: Dynamic = items2[input2],
          value6: Dynamic = items[options2],
          value7: Dynamic = items2[options2],
          index2: Dynamic = 0,
          index3: Dynamic = 0,
          index4: Dynamic = 0,
          index5: Dynamic = 0,
          index6: Dynamic = 0;
        for (let value12: Dynamic = input2; value12 <= options2; value12++) {
          let value13: Dynamic = value[value12 - input2],
            value14: Dynamic = 1 - value13,
            value15: Dynamic = 3 * value14 * value14 * value13,
            value16: Dynamic = 3 * value14 * value13 * value13,
            value17: Dynamic = value14 * value14 * value14 + value15,
            value18: Dynamic = value16 + value13 * value13 * value13,
            value19: Dynamic = context * value15,
            value20: Dynamic = value3 * value15,
            value21: Dynamic = extra * value16,
            value22: Dynamic = detail * value16,
            value23: Dynamic =
              items[value12] - value4 * value17 - value6 * value18,
            value24: Dynamic =
              items2[value12] - value5 * value17 - value7 * value18;
          index2 += value19 * value19 + value20 * value20;
          index3 += value19 * value21 + value20 * value22;
          index4 += value21 * value21 + value22 * value22;
          index5 += value19 * value23 + value20 * value24;
          index6 += value21 * value23 + value22 * value24;
        }
        let value8: Dynamic = index2 * index4 - index3 * index3,
          index7: Dynamic = 0,
          index8: Dynamic = 0;
        Math.abs(value8) > 1e-12
          ? ((index7 = (index5 * index4 - index6 * index3) / value8),
            (index8 = (index2 * index6 - index3 * index5) / value8))
          : Math.abs(index2 + index3) > 1e-12 &&
            (index7 = index8 = index5 / (index2 + index3));
        let value9: Dynamic = value6 - value4,
          value10: Dynamic = value7 - value5,
          value11: Dynamic = Math.sqrt(value9 * value9 + value10 * value10);
        (index7 < 1e-6 * value11 ||
          index8 < 1e-6 * value11 ||
          index7 * (context * value9 + value3 * value10) -
            index8 * (extra * value9 + detail * value10) >
            value11 * value11) &&
          (index7 = index8 = value11 / 3);
        return [
          value4 + context * index7,
          value5 + value3 * index7,
          value6 + extra * index8,
          value7 + detail * index8,
        ];
      },
      callback6: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value3?: Dynamic,
        extra?: Dynamic,
        detail?: Dynamic,
      ): Dynamic => {
        let value4: Dynamic = items[input2],
          value5: Dynamic = items2[input2],
          value6: Dynamic = items[options2],
          value7: Dynamic = items2[options2];
        if (options2 - input2 === 1) {
          let value16: Dynamic = Math.sqrt(
              (value6 - value4) * (value6 - value4) +
                (value7 - value5) * (value7 - value5),
            ),
            [value17, value18]: Dynamic = callback(
              value6 - value4,
              value7 - value5,
            ),
            value19: Dynamic =
              (value16 / 3) *
              Math.max(0.05, context * value17 + value3 * value18),
            value20: Dynamic =
              (value16 / 3) *
              Math.max(0.05, -(extra * value17 + detail * value18));
          callback2(
            value4 + context * value19,
            value5 + value3 * value19,
            value6 + extra * value20,
            value7 + detail * value20,
            value6,
            value7,
          );
          return;
        }
        value[0] = 0;
        for (let value16: Dynamic = input2 + 1; value16 <= options2; value16++)
          value[value16 - input2] =
            value[value16 - input2 - 1] +
            Math.sqrt(
              (items[value16] - items[value16 - 1]) ** 2 +
                (items2[value16] - items2[value16 - 1]) ** 2,
            );
        for (let count: Dynamic = 1; count <= options2 - input2; count++)
          value[count] =
            value[options2 - input2] > 0
              ? value[count] / value[options2 - input2]
              : 0;
        let value8: Dynamic = (input2 + options2) >> 1,
          value9: Dynamic = 4 * value2;
        for (let index2: Dynamic = 0; index2 <= 4; index2++) {
          let [value16, value17, value18, value19]: Dynamic = callback5(
              input2,
              options2,
              context,
              value3,
              extra,
              detail,
            ),
            index3: Dynamic = 0,
            value20: Dynamic = (input2 + options2) >> 1,
            flag: Dynamic = true;
          for (
            let value21: Dynamic = input2 + 1;
            value21 < options2;
            value21++
          ) {
            let value22: Dynamic = value[value21 - input2],
              value23: Dynamic = 1 - value22,
              value24: Dynamic = 3 * value23 * value23 * value22,
              value25: Dynamic = 3 * value23 * value22 * value22,
              value26: Dynamic =
                value23 * value23 * value23 * value4 +
                value24 * value16 +
                value25 * value18 +
                value22 * value22 * value22 * value6 -
                items[value21],
              value27: Dynamic =
                value23 * value23 * value23 * value5 +
                value24 * value17 +
                value25 * value19 +
                value22 * value22 * value22 * value7 -
                items2[value21];
            value26 * value26 + value27 * value27 >= index3 &&
              ((index3 = value26 * value26 + value27 * value27),
              (value20 = value21));
            let value28: Dynamic =
                3 *
                (value23 * value23 * (value16 - value4) +
                  2 * value23 * value22 * (value18 - value16) +
                  value22 * value22 * (value6 - value18)),
              value29: Dynamic =
                3 *
                (value23 * value23 * (value17 - value5) +
                  2 * value23 * value22 * (value19 - value17) +
                  value22 * value22 * (value7 - value19)),
              value30: Dynamic =
                6 *
                (value23 * (value18 - 2 * value16 + value4) +
                  value22 * (value6 - 2 * value18 + value16)),
              value31: Dynamic =
                6 *
                (value23 * (value19 - 2 * value17 + value5) +
                  value22 * (value7 - 2 * value19 + value17)),
              value32: Dynamic =
                value28 * value28 +
                value29 * value29 +
                value26 * value30 +
                value27 * value31,
              value33: Dynamic =
                Math.abs(value32) > 1e-9
                  ? value22 - (value26 * value28 + value27 * value29) / value32
                  : value22;
            (value33 <= value[value21 - input2 - 1] || value33 >= 1) &&
              (flag = false);
            value[value21 - input2] = value33;
          }
          if (index3 < value2) {
            callback2(value16, value17, value18, value19, value6, value7);
            return;
          }
          value8 = value20;
          if (index3 >= value9 || !flag) break;
          value9 = index3;
        }
        let [value10, value11]: Dynamic = callback4(value8, input2),
          [value12, value13]: Dynamic = callback4(value8, options2),
          [value14, value15]: Dynamic = callback(
            value10 - value12,
            value11 - value13,
          );
        callback6(input2, value8, context, value3, value14, value15);
        callback6(value8, options2, -value14, -value15, extra, detail);
      },
      callback7: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let [items4, items5]: Dynamic = [items[input2], items2[input2]];
        for (let value3: Dynamic = input2 + 1; value3 < options2; value3++) {
          let [items6, items7]: Dynamic = [items[value3], items2[value3]];
          callback3(value3, value3 + 1) < 4 * options &&
            Math.sqrt((items6 - items4) ** 2 + (items7 - items5) ** 2) <
              4 * options &&
            ((items[value3] = (items4 + 2 * items6 + items[value3 + 1]) / 4),
            (items2[value3] = (items5 + 2 * items7 + items2[value3 + 1]) / 4));
          [items4, items5] = [items6, items7];
        }
        callback6(
          input2,
          options2,
          ...callback4(input2, options2),
          ...callback4(options2, input2),
        );
      },
      index: Dynamic = 0,
      callback8: Dynamic = (input2?: Dynamic): Dynamic => {
        if (
          input2 <= index ||
          input2 + 1 >= length ||
          callback3(input2, input2 - 1) > 16 * options ||
          callback3(input2, input2 + 1) > 16 * options
        )
          return 1;
        let [items4, items5]: Dynamic = [input2 - 1, input2 + 1];
        for (; items4 > index && callback3(input2, items4) < 4 * options; )
          items4--;
        for (; items5 < length - 1 && callback3(input2, items5) < 4 * options; )
          items5++;
        let [value3, value4]: Dynamic = callback(
            items[input2] - items[items4],
            items2[input2] - items2[items4],
          ),
          [value5, value6]: Dynamic = callback(
            items[items5] - items[input2],
            items2[items5] - items2[input2],
          );
        return value3 * value5 + value4 * value6;
      };
    for (let count: Dynamic = 1; count + 1 < length; count++) {
      let value3: Dynamic = callback8(count);
      value3 < 0.5 &&
        value3 <= callback8(count + 1) &&
        (callback7(index, count), (index = count));
    }
    callback7(index, length - 1);
    return items3;
  }
  function flattenCubicPath(items?: Dynamic, options: Dynamic = 0.05): Dynamic {
    let items2: Dynamic = [items[0], items[1]];
    if (items.length === 4) return [...items];
    for (let count: Dynamic = 2; count + 5 < items.length; count += 6) {
      let value: Dynamic = items2[items2.length - 2],
        value2: Dynamic = items2[items2.length - 1],
        [items3, items4, items5, items6]: Dynamic = [
          items[count],
          items[count + 1],
          items[count + 2],
          items[count + 3],
        ],
        [items7, items8]: Dynamic = [items[count + 4], items[count + 5]],
        items9: Dynamic = [];
      for (let [value3, value4, value5, value6] of [
        [value, items3, items5, items7],
        [value2, items4, items6, items8],
      ] as Dynamic) {
        if (
          Math.min(value4, value5) >= Math.min(value3, value6) - options &&
          Math.max(value4, value5) <= Math.max(value3, value6) + options
        )
          continue;
        let value7: Dynamic = -value3 + 3 * value4 - 3 * value5 + value6,
          value8: Dynamic = 2 * (value3 - 2 * value4 + value5),
          value9: Dynamic = value4 - value3,
          value10: Dynamic =
            Math.abs(value7) < 1e-9
              ? Math.abs(value8) < 1e-9
                ? []
                : [-value9 / value8]
              : ((input?: Dynamic): Dynamic =>
                  input < 0
                    ? []
                    : [
                        (-value8 + Math.sqrt(input)) / (2 * value7),
                        (-value8 - Math.sqrt(input)) / (2 * value7),
                      ])(value8 * value8 - 4 * value7 * value9);
        for (let value11 of value10 as Dynamic)
          value11 > 0.001 && value11 < 1 - 0.001 && items9.push(value11);
      }
      items9.sort(
        (input?: Dynamic, options2?: Dynamic): Dynamic => input - options2,
      );
      let index: Dynamic = 0;
      for (let value3 of items9 as Dynamic) {
        let value4: Dynamic = (value3 - index) / (1 - index);
        if (value4 <= 0.001 || value4 >= 1 - 0.001) continue;
        let value5: Dynamic = value + (items3 - value) * value4,
          value6: Dynamic = value2 + (items4 - value2) * value4,
          value7: Dynamic = items3 + (items5 - items3) * value4,
          value8: Dynamic = items4 + (items6 - items4) * value4,
          value9: Dynamic = items5 + (items7 - items5) * value4,
          value10: Dynamic = items6 + (items8 - items6) * value4,
          value11: Dynamic = value5 + (value7 - value5) * value4,
          value12: Dynamic = value6 + (value8 - value6) * value4,
          value13: Dynamic = value7 + (value9 - value7) * value4,
          value14: Dynamic = value8 + (value10 - value8) * value4,
          value15: Dynamic = value11 + (value13 - value11) * value4,
          value16: Dynamic = value12 + (value14 - value12) * value4;
        (value15 - value) ** 2 + (value16 - value2) ** 2 < 0.25 ||
          (value15 - items7) ** 2 + (value16 - items8) ** 2 < 0.25 ||
          (items2.push(value5, value6, value11, value12, value15, value16),
          ([value, value2, items3, items4, items5, items6] = [
            value15,
            value16,
            value13,
            value14,
            value9,
            value10,
          ]),
          (index = value3));
      }
      items2.push(items3, items4, items5, items6, items7, items8);
    }
    return items2;
  }
  function serializePenPath(items?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = Math.pow(10, options),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value3: Dynamic = (Math.round(input * value) / value).toFixed(
          options,
        );
        value3.indexOf(".") >= 0 && (value3 = value3.replace(/\.?0+$/, ""));
        return value3 === "-0" ? "0" : value3;
      },
      value2: Dynamic = "M" + callback(items[0]) + " " + callback(items[1]);
    if (items.length === 4)
      return value2 + " L" + callback(items[2]) + " " + callback(items[3]);
    for (let count: Dynamic = 2; count < items.length; count++)
      value2 += ((count - 2) % 6 === 0 ? " C" : " ") + callback(items[count]);
    return value2;
  }
  function penPathBounds(items?: Dynamic, options?: Dynamic): Dynamic {
    let [items2, items3, items4, items5]: Dynamic = [
      1 / 0,
      1 / 0,
      -1 / 0,
      -1 / 0,
    ];
    for (let index: Dynamic = 0; index + 1 < items.length; index += 2)
      [items2, items3, items4, items5] = [
        Math.min(items2, items[index]),
        Math.min(items3, items[index + 1]),
        Math.max(items4, items[index]),
        Math.max(items5, items[index + 1]),
      ];
    let value: Dynamic = 10 ** options,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        Math.round(input * value) / value;
    return {
      x: items2,
      y: items3,
      w: callback(items4 - items2),
      h: callback(items5 - items3),
      d: serializePenPath(
        items.map(
          (input?: Dynamic, options2?: Dynamic): Dynamic =>
            input - (options2 % 2 === 0 ? items2 : items3),
        ),
        options,
      ),
    };
  }
  function parsePenPath(input?: Dynamic, options: Dynamic = 12): Dynamic {
    let items: Dynamic = [];
    for (let value of (input.match(/[MLC][^MLC]*/g) ?? []) as Dynamic) {
      let value2: Dynamic = (
          value.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []
        ).map(Number),
        value3: Dynamic = items[items.length - 1];
      if (value[0] === "C" && value3 && value2.length >= 6)
        for (let count: Dynamic = 1; count <= options; count++) {
          let value4: Dynamic = count / options,
            value5: Dynamic = 1 - value4;
          items.push({
            move: false,
            x:
              value5 * value5 * value5 * value3.x +
              3 * value5 * value5 * value4 * value2[0] +
              3 * value5 * value4 * value4 * value2[2] +
              value4 * value4 * value4 * value2[4],
            y:
              value5 * value5 * value5 * value3.y +
              3 * value5 * value5 * value4 * value2[1] +
              3 * value5 * value4 * value4 * value2[3] +
              value4 * value4 * value4 * value2[5],
          });
        }
      else
        value2.length >= 2 &&
          items.push({
            move: value[0] === "M" || !value3,
            x: value2[0],
            y: value2[1],
          });
    }
    return items;
  }
  bindRuntimeValue(runtime, "fitPenCurve", () => fitPenCurve);
  bindRuntimeValue(runtime, "flattenCubicPath", () => flattenCubicPath);
  bindRuntimeValue(runtime, "serializePenPath", () => serializePenPath);
  bindRuntimeValue(runtime, "penPathBounds", () => penPathBounds);
  bindRuntimeValue(runtime, "parsePenPath", () => parsePenPath);
  return () => {};
}
