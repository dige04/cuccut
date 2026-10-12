/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTypographyGoogleFonts(
  runtime: RuntimeBindings,
): () => void {
  function parseGoogleFontsRequest(
    items?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let text: Dynamic = "https://fonts.googleapis.com/css2?";
    if (
      typeof items != "string" ||
      items.length > 1024 ||
      items.slice(0, text.length) !== text
    )
      return [];
    let value: Dynamic = items.slice(text.length).split("&");
    if (value.some((input?: Dynamic): Dynamic => input.slice(0, 5) === "text="))
      return [];
    let items2: Dynamic = [];
    for (let value2 of value as Dynamic) {
      if (value2.slice(0, 7) !== "family=") continue;
      let value3: Dynamic = items2.length + 16,
        value4: Dynamic = value2.slice(7).replace(/%20| /g, "+"),
        value5: Dynamic = value4.indexOf(":"),
        value6: Dynamic = value5 < 0 ? value4 : value4.slice(0, value5);
      if (!/^[A-Za-z0-9][A-Za-z0-9+._-]{0,99}$/.test(value6)) continue;
      let items3: Dynamic = [["0", "400"]];
      if (value5 >= 0) {
        let value10: Dynamic = value4.indexOf("@", value5),
          value11: Dynamic = value4
            .slice(value5 + 1, value10 < 0 ? value5 : value10)
            .split(","),
          value12: Dynamic = value11.indexOf("ital"),
          value13: Dynamic = value11.indexOf("wght");
        if (
          value10 < 0 ||
          value11.some(
            (input?: Dynamic): Dynamic => input !== "ital" && input !== "wght",
          )
        )
          continue;
        items3 = [];
        for (let value14 of value4.slice(value10 + 1).split(";") as Dynamic) {
          let value15: Dynamic = value14.split(","),
            items4: Dynamic = [
              value12 < 0 ? "0" : (value15[value12] ?? ""),
              value13 < 0 ? "400" : (value15[value13] ?? ""),
            ];
          if (
            value15.length !== value11.length ||
            !/^[01]$/.test(items4[0]) ||
            !/^[1-9]\d{0,3}(?:\.\.[1-9]\d{0,3})?$/.test(items4[1])
          ) {
            items3 = [];
            break;
          }
          items3.push(items4);
        }
        if (items3.length === 0) continue;
      }
      let value7: Dynamic = items3.map(
          (input?: Dynamic): Dynamic => input[0] + "," + input[1],
        ),
        value8: Dynamic =
          options !== undefined &&
          Object.prototype.hasOwnProperty.call(
            options,
            value6.replace(/\+/g, " ").toLowerCase(),
          )
            ? options[value6.replace(/\+/g, " ").toLowerCase()]
            : undefined,
        value9: Dynamic;
      if (value8 !== undefined) {
        let callback: Dynamic = (
          input?: Dynamic,
          options2?: Dynamic,
        ): Dynamic =>
          items3.some(
            (input2?: Dynamic): Dynamic =>
              input2[0] === input &&
              options2 >= Number(input2[1].split("..")[0]) &&
              options2 <= Number(input2[1].split("..").pop()),
          );
        value9 = [];
        for (let value10 of (value8.italic ? ["0", "1"] : ["0"]) as Dynamic) {
          if (value8.wght === undefined) {
            for (let value11 of (value8.statics ?? []) as Dynamic)
              callback(value10, value11) ||
                value9.push(value10 + "," + String(value11));
            continue;
          }
          let index: Dynamic = 0;
          for (
            let value11: Dynamic = value8.wght[0];
            value11 <= value8.wght[1] + 100;
            value11 += 100
          ) {
            let value12: Dynamic =
              value11 <= value8.wght[1] && !callback(value10, value11);
            value12 && index === 0 && (index = value11);
            !value12 &&
              index !== 0 &&
              (value9.push(
                value10 +
                  "," +
                  String(index) +
                  (value11 - 100 > index ? ".." + String(value11 - 100) : ""),
              ),
              (index = 0));
          }
        }
      } else {
        let callback: Dynamic = (input?: Dynamic): Dynamic =>
            Number(input[1].split("..").pop()) >= 600,
          value10: Dynamic = items3.filter(
            (input?: Dynamic): Dynamic => input[0] === "0",
          );
        value9 = value10
          .map((input?: Dynamic): Dynamic => "1," + input[1])
          .concat(
            value10.some(callback) ? [] : ["0,700"],
            items3.some(callback) ? [] : ["1,700"],
          );
      }
      for (let value10 of value9 as Dynamic) {
        let value11: Dynamic =
          text + "family=" + value6 + ":ital,wght@" + value10 + "&display=swap";
        value7.indexOf(value10) < 0 &&
          items2.indexOf(value11) < 0 &&
          items2.length < value3 &&
          items2.push(value11);
      }
    }
    return items2;
  }
  bindRuntimeValue(
    runtime,
    "parseGoogleFontsRequest",
    () => parseGoogleFontsRequest,
  );
  return () => {};
}
