/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureAssets(
  runtime: RuntimeBindings,
): () => void {
  function sanitizeXmlCharacters(input?: Dynamic): Dynamic {
    return input.replace(
      /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDFFF]/g,
      (items?: Dynamic): Dynamic =>
        items.length === 2
          ? items
          : items < "\uD800" || items > "\uDFFF"
            ? ""
            : "\uFFFD",
    );
  }
  function collectCssImageUrls(input?: Dynamic): Dynamic {
    if (!input || input.indexOf("url(") === -1) return [];
    let value: Dynamic = /url\((['"]?)([^'")]+)\1\)/g,
      items: Dynamic = [],
      state: Dynamic = {},
      value2: Dynamic;
    for (; (value2 = value.exec(input)); )
      value2[2].indexOf("data:") === 0 ||
        state[value2[0]] ||
        ((state[value2[0]] = 1),
        items.push({
          full: value2[0],
          url: value2[2],
        }));
    return items;
  }
  function replaceCssImageUrls(input?: Dynamic, items?: Dynamic): Dynamic {
    let value: Dynamic = input;
    for (let index: Dynamic = 0; index < items.length; index++)
      value = value
        .split(items[index].full)
        .join('url("' + items[index].d + '")');
    return value;
  }
  function prepareWebGlCanvasCapture(
    doc?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [],
      callback: Dynamic = (): Dynamic => {
        for (let index: Dynamic = 0; index < items.length; index++)
          try {
            delete items[index].c.__omCapGl;
          } catch {}
      };
    try {
      let callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let value: Dynamic = input.querySelectorAll("*");
        for (let index: Dynamic = 0; index < value.length; index++) {
          let value2: Dynamic = value[index];
          if (value2.tagName.toUpperCase() === "CANVAS") {
            let value3: Dynamic = value2;
            if (value3.width && value3.height) {
              let state: Dynamic = {
                url: null,
              };
              value3.__omCapGl = state;
              items.push({
                c: value3,
                m: state,
              });
            }
          }
          value2.shadowRoot && callback2(value2.shadowRoot);
        }
      };
      callback2(doc);
    } catch {}
    return !items.length || doc.hidden
      ? Promise.resolve(callback)
      : new Promise((input?: Dynamic): Dynamic => {
          let flag: Dynamic = false,
            callback2: Dynamic = (input2?: Dynamic): Dynamic => {
              if (!flag) {
                flag = true;
                if (input2)
                  for (let index: Dynamic = 0; index < items.length; index++)
                    try {
                      let { c: value, m: value2 }: Dynamic = items[index],
                        value3: Dynamic = doc.createElement("canvas");
                      value3.width = value.width;
                      value3.height = value.height;
                      let value4: Dynamic = value3.getContext("2d");
                      if (!value4) continue;
                      value4.drawImage(value, 0, 0);
                      let data: Dynamic = value4.getImageData(
                        0,
                        0,
                        value3.width,
                        value3.height,
                      ).data;
                      for (
                        let count: Dynamic = 3;
                        count < data.length;
                        count += 4
                      )
                        if (data[count]) {
                          value2.url = value3.toDataURL();
                          break;
                        }
                    } catch {}
                input(callback);
              }
            };
          options.requestAnimationFrame((): Dynamic => callback2(true));
          options.setTimeout((): Dynamic => callback2(false), 200);
        });
  }
  bindRuntimeValue(
    runtime,
    "sanitizeXmlCharacters",
    () => sanitizeXmlCharacters,
  );
  bindRuntimeValue(runtime, "collectCssImageUrls", () => collectCssImageUrls);
  bindRuntimeValue(runtime, "replaceCssImageUrls", () => replaceCssImageUrls);
  bindRuntimeValue(
    runtime,
    "prepareWebGlCanvasCapture",
    () => prepareWebGlCanvasCapture,
  );
  return () => {};
}
