/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfStructure(
  runtime: RuntimeBindings,
): () => void {
  function collectPdfStructureRoles(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [];
    return options.map((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      let value: Dynamic = (input[options2].blocks ?? []).map(
          (input3?: Dynamic): Dynamic => input3.role,
        ),
        values: Dynamic = new Set(
          input2.map((input3?: Dynamic): Dynamic => input3.block),
        );
      value.forEach((input3?: Dynamic, options3?: Dynamic): Dynamic => {
        let value2: Dynamic = values.has(options3)
          ? /^H([1-6])$/.exec(input3)
          : null;
        if (value2 === null) return;
        let value3: Dynamic = Number(value2[1]);
        for (; items.length > 0 && items[items.length - 1] >= value3; )
          items.pop();
        items.push(value3);
        value[options3] = "H" + String(items.length);
      });
      return value;
    });
  }
  function buildPdfStructureTree(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
    argument?: Dynamic,
    argument2?: Dynamic,
    argument3?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = input,
      callback: Dynamic = (): Dynamic => value2++,
      value3: Dynamic = callback(),
      value4: Dynamic = callback(),
      value5: Dynamic = callback(),
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        String(input2) + " 0 R",
      callback3: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context2?: Dynamic,
        value6?: Dynamic,
        extra2: Dynamic = "",
      ): Dynamic =>
        "<< /Type /StructElem /S /" +
        input2 +
        " /P " +
        callback2(options) +
        " /Pg " +
        callback2(argument3(context2)) +
        extra2 +
        " /K " +
        value6 +
        " >>",
      callback4: Dynamic = (items6?: Dynamic): Dynamic =>
        items6.length === 1 ? String(items6[0]) : "[" + items6.join(" ") + "]",
      entries: Dynamic = new Map(),
      items2: Dynamic = [],
      items3: Dynamic = [],
      items4: Dynamic = [];
    items.forEach((input2?: Dynamic, options?: Dynamic): Dynamic => {
      let value6: Dynamic = callback();
      items2.push(value6);
      let items6: Dynamic = [],
        items7: Dynamic = [],
        entries2: Dynamic = new Map(),
        items8: Dynamic = [],
        entries3: Dynamic = new Map(),
        values: Dynamic = new Set(
          [...context[options].marks, ...value[options].marks].map(
            (input3?: Dynamic): Dynamic => input3.block,
          ),
        ),
        values2: Dynamic = new Set(
          argument[options].filter(
            (input3?: Dynamic): Dynamic => input3 !== undefined,
          ),
        ),
        entries4: Dynamic = new Map();
      for (let [value7, value8] of argument2[options] as Dynamic)
        values2.has(value7) && entries4.set(value8, value7);
      let entries5: Dynamic = new Map(),
        index: Dynamic = 0,
        callback5: Dynamic = (input3?: Dynamic): Dynamic => {
          for (; index <= input3; index++) {
            if (!values.has(index)) continue;
            let value7: Dynamic = callback(),
              value8: Dynamic = input2.blocks[index],
              value9: Dynamic =
                value8.role === "Table"
                  ? {
                      rows: Array.from(
                        {
                          length: value8.rows,
                        },
                        callback,
                      ),
                      cells: Array.from(
                        {
                          length: value8.rows * value8.cols,
                        },
                        callback,
                      ),
                      mcids: Array.from(
                        {
                          length: value8.rows * value8.cols,
                        },
                        (): Dynamic => [],
                      ),
                    }
                  : undefined;
            entries2.set(index, {
              obj: value7,
              mcids: [],
              items: new Map(),
              table: value9,
            });
            let entry: Dynamic = entries4.get(index);
            if (entry === undefined) {
              items6.push(value7);
              continue;
            }
            let state: Dynamic = {
              obj: callback(),
              kids: [callback2(value7)],
              parent: value6,
            };
            items8.push(state);
            entries3.set(entry, state);
            entries5.set(index, state.obj);
            items6.push(state.obj);
          }
        },
        callback6: Dynamic = (
          input3?: Dynamic,
          options2?: Dynamic,
          context2?: Dynamic,
        ): Dynamic => {
          if (input3.link === undefined) {
            context2.push(input3.mcid);
            items7[input3.mcid] = options2;
            return;
          }
          let state: Dynamic = {
            obj: callback(),
            kids: [input3.mcid],
            parent: options2,
          };
          items8.push(state);
          entries3.has(input3.link) || entries3.set(input3.link, state);
          context2.push(callback2(state.obj));
          items7[input3.mcid] = state.obj;
        };
      for (let value7 of context[options].marks as Dynamic) {
        if (value7.block === undefined) {
          let value8: Dynamic = callback();
          items6.push(value8);
          let items9: Dynamic = [];
          callback6(value7, value8, items9);
          entries.set(
            value8,
            callback3("P", value6, options, callback4(items9)),
          );
          continue;
        }
        callback5(value7.block);
        let entry: Dynamic = entries2.get(value7.block);
        if (entry.table !== undefined)
          callback6(
            value7,
            entry.table.cells[value7.item],
            entry.table.mcids[value7.item],
          );
        else if (value7.item === undefined)
          callback6(value7, entry.obj, entry.mcids);
        else {
          let entry2: Dynamic = entry.items.get(value7.item);
          entry2 === undefined &&
            ((entry2 = {
              li: callback(),
              body: callback(),
              mcids: [],
            }),
            entry.items.set(value7.item, entry2));
          callback6(value7, entry2.body, entry2.mcids);
        }
      }
      callback5((input2.blocks?.length ?? 0) - 1);
      for (let value7 of value[options].marks as Dynamic) {
        entries2.get(value7.block).mcids.push(value7.mcid);
        items7[value7.mcid] = entries2.get(value7.block).obj;
      }
      for (let [value7, value8] of entries2 as Dynamic) {
        let value9: Dynamic = extra[options][value7];
        if (value9 === "Figure") {
          let value11: Dynamic = input2.blocks[value7],
            value12: Dynamic = (0, runtime.clipPdfBlockBox)(
              value11,
              input2.widthPt,
              input2.heightPt,
            ),
            value13: Dynamic =
              typeof value11.alt == "string"
                ? (0, runtime.truncatePdfText)(
                    value11.alt,
                    runtime.PdfFigureOperatorsConstant,
                  ).trim()
                : "",
            value14: Dynamic =
              value13 !== ""
                ? " /Alt " + (0, runtime.pdfStringOperand)(value13)
                : "";
          entries.set(
            value8.obj,
            callback3(
              "Figure",
              entries5.get(value7) ?? value6,
              options,
              callback4(value8.mcids),
              value14 +
                " /A << /O /Layout /BBox [" +
                [value12.x0, value12.y0, value12.x1, value12.y1]
                  .map(runtime.formatPdfNumber)
                  .join(" ") +
                "] /Placement /Block >>",
            ),
          );
          continue;
        }
        if (value9 === "Table") {
          let { cols: value11 }: Dynamic = input2.blocks[value7],
            value12: Dynamic = input2.blocks[value7].headerRows ?? 0,
            table: Dynamic = value8.table;
          entries.set(
            value8.obj,
            callback3(
              "Table",
              value6,
              options,
              "[" + table.rows.map(callback2).join(" ") + "]",
            ),
          );
          table.rows.forEach(
            (input3?: Dynamic, options2?: Dynamic): Dynamic => {
              entries.set(
                input3,
                callback3(
                  "TR",
                  value8.obj,
                  options,
                  "[" +
                    table.cells
                      .slice(options2 * value11, (options2 + 1) * value11)
                      .map(callback2)
                      .join(" ") +
                    "]",
                ),
              );
              for (let index2: Dynamic = 0; index2 < value11; index2++) {
                let value13: Dynamic = options2 * value11 + index2,
                  value14: Dynamic =
                    options2 < value12
                      ? " /A << /O /Table /Scope /Column >>"
                      : "",
                  value15: Dynamic = table.mcids[value13];
                entries.set(
                  table.cells[value13],
                  value15.length === 0
                    ? "<< /Type /StructElem /S /" +
                        (options2 < value12 ? "TH" : "TD") +
                        " /P " +
                        callback2(input3) +
                        " /Pg " +
                        callback2(argument3(options)) +
                        value14 +
                        " >>"
                    : callback3(
                        options2 < value12 ? "TH" : "TD",
                        input3,
                        options,
                        callback4(value15),
                        value14,
                      ),
                );
              }
            },
          );
          continue;
        }
        if (value9 !== "L") {
          entries.set(
            value8.obj,
            callback3(value9, value6, options, callback4(value8.mcids)),
          );
          continue;
        }
        let numbering: Dynamic = input2.blocks[value7].numbering,
          value10: Dynamic =
            numbering == null
              ? ""
              : " /A << /O /List /ListNumbering /" + numbering + " >>";
        entries.set(
          value8.obj,
          callback3(
            "L",
            value6,
            options,
            "[" +
              [...value8.items.values()]
                .map((input3?: Dynamic): Dynamic => callback2(input3.li))
                .join(" ") +
              "]",
            value10,
          ),
        );
        for (let value11 of value8.items.values() as Dynamic) {
          entries.set(
            value11.li,
            callback3(
              "LI",
              value8.obj,
              options,
              "[" + callback2(value11.body) + "]",
            ),
          );
          entries.set(
            value11.body,
            callback3("LBody", value11.li, options, callback4(value11.mcids)),
          );
        }
      }
      let entries6: Dynamic = new Map();
      detail[options].forEach(
        (input3?: Dynamic, options2?: Dynamic): Dynamic => {
          let value7: Dynamic =
              "<< /Type /OBJR /Obj " +
              callback2(input3) +
              " /Pg " +
              callback2(argument3(options)) +
              " >>",
            value8: Dynamic = argument[options][options2],
            value9: Dynamic =
              value8 === undefined ? undefined : entries3.get(value8)?.obj;
          value9 !== undefined
            ? entries6.set(value9, [...(entries6.get(value9) ?? []), value7])
            : ((value9 = callback()),
              items6.push(value9),
              entries.set(value9, callback3("Link", value6, options, value7)));
          items4.push(
            String(items.length + items4.length) + " " + callback2(value9),
          );
        },
      );
      for (let value7 of items8 as Dynamic)
        entries.set(
          value7.obj,
          callback3(
            "Link",
            value7.parent,
            options,
            callback4([...value7.kids, ...(entries6.get(value7.obj) ?? [])]),
          ),
        );
      entries.set(
        value6,
        items6.length === 0
          ? "<< /Type /StructElem /S /Sect /P " +
              callback2(value5) +
              " /Pg " +
              callback2(argument3(options)) +
              " >>"
          : callback3(
              "Sect",
              value5,
              options,
              "[" + items6.map(callback2).join(" ") + "]",
            ),
      );
      items3.push(
        String(options) + " [" + items7.map(callback2).join(" ") + "]",
      );
    });
    let items5: Dynamic = [];
    items5[value3 - input] =
      "<< /Type /StructTreeRoot /K " +
      callback2(value5) +
      " /ParentTree " +
      callback2(value4) +
      " /ParentTreeNextKey " +
      String(items.length + items4.length) +
      " >>";
    items5[value4 - input] =
      "<< /Nums [" + [...items3, ...items4].join(" ") + "] >>";
    items5[value5 - input] =
      "<< /Type /StructElem /S /Document /P " +
      callback2(value3) +
      " /K [" +
      items2.map(callback2).join(" ") +
      "] >>";
    for (let [value6, value7] of entries as Dynamic)
      items5[value6 - input] = value7;
    return {
      rootObj: value3,
      nextObj: value2,
      bodies: items5,
    };
  }
  bindRuntimeValue(
    runtime,
    "collectPdfStructureRoles",
    () => collectPdfStructureRoles,
  );
  bindRuntimeValue(
    runtime,
    "buildPdfStructureTree",
    () => buildPdfStructureTree,
  );
  return () => {};
}
