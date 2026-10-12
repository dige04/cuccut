/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorMediaImageReplacement(
  runtime: RuntimeBindings,
): () => void {
  function imageElementSizing(
    input?: Dynamic,
    options?: Dynamic,
    element?: Dynamic,
  ): Dynamic {
    let attribute: Dynamic = element.getAttribute("width"),
      attribute2: Dynamic = element.getAttribute("height"),
      value: Dynamic = input.inlineStyleValue(options, "width") || null,
      value2: Dynamic = input.inlineStyleValue(options, "height") || null,
      value3: Dynamic = input.inlineStyleValue(options, "aspect-ratio") || null,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 != null && input2 !== "auto";
    return {
      pin:
        (!!attribute &&
          !!attribute2 &&
          value === `${attribute}px` &&
          value3 === `${attribute} / ${attribute2}` &&
          !callback(value2)) ||
        (!attribute &&
          !attribute2 &&
          !callback(value) &&
          !callback(value2) &&
          !callback(value3)),
      old: {
        width: attribute,
        height: attribute2,
        styleWidth: value,
        styleHeight: value2,
        styleAspectRatio: value3,
      },
    };
  }
  async function replaceSelectedImage(input?: Dynamic): Promise<Dynamic> {
    let {
        file: value,
        el: value2,
        getModel: value3,
        upload: value4,
        pushUndo: value5,
        afterPatch: value6,
        recordSettled: value7,
      }: Dynamic = input,
      value8: Dynamic = input.isCurrent ?? ((): Dynamic => true),
      value9: Dynamic = input.preview ?? runtime.previewImageFile,
      value10: Dynamic = parseInt(
        value2.getAttribute(runtime.DcTplAttribute) ?? "-1",
        10,
      ),
      attribute: Dynamic = value2.getAttribute("src"),
      attribute2: Dynamic = value2.getAttribute("alt"),
      value11: Dynamic = imageElementSizing(value3(), value10, value2),
      state: Dynamic = {
        width: value11.old.width,
        height: value11.old.height,
        ...(value11.pin
          ? {
              [`${runtime.StyleValue}width`]: value11.old.styleWidth,
              [`${runtime.StyleValue}height`]: value11.old.styleHeight,
              [`${runtime.StyleValue}aspect-ratio`]:
                value11.old.styleAspectRatio,
            }
          : {}),
      },
      flag: Dynamic = false,
      value12: Dynamic = null,
      value13: Dynamic = null,
      value14: Dynamic = null,
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        if (!("alt" in input2) || attribute2 == null) return input2;
        let { alt: value15, ...value16 }: Dynamic = input2;
        return value16;
      },
      flag2: Dynamic = false;
    return {
      failed:
        (await (0, runtime.insertUploadedFiles)({
          files: [value],
          targets: [value2],
          upload: async (input2?: Dynamic): Promise<Dynamic> => {
            let value15: Dynamic = await value4(input2);
            value13 = value15.relName;
            value14 = value15.src;
            return value15;
          },
          preview: value9,
          patch: (element?: Dynamic, options?: Dynamic): Dynamic => {
            if (!value8()) return true;
            let value15: Dynamic = value3(),
              value16: Dynamic = parseInt(
                element.getAttribute(runtime.DcTplAttribute) ?? "-1",
                10,
              );
            if (value16 < 0 || value15.element(value16) !== element)
              return false;
            let value17: Dynamic = callback(options),
              value18: Dynamic = Object.entries(value17).filter(
                ([input2, input3]: Dynamic): Dynamic =>
                  input2.startsWith(runtime.StyleValue)
                    ? (value15.inlineStyleValue(
                        value16,
                        input2.slice(runtime.StyleValue.length),
                      ) || null) !== input3
                    : element.getAttribute(input2) !== input3,
              );
            if (value18.length === 0) return true;
            flag || (value5(), (flag = true));
            for (let [value20, value21] of value18 as Dynamic)
              value20.startsWith(runtime.StyleValue)
                ? value15.setStyleProperty(
                    value16,
                    value20.slice(runtime.StyleValue.length),
                    value21,
                  )
                : value15.setAttribute(value16, value20, value21);
            let value19: Dynamic = value18.find(
              ([input2]: Dynamic): Dynamic => input2 === "src",
            );
            if (value19 && (value19[1] ?? "") === (attribute ?? "")) {
              for (let [value20, value21] of (value12 ?? []) as Dynamic)
                value15.setStyleProperty(value16, value20, value21);
              value12 = null;
            } else if (
              value19 &&
              value12 === null &&
              ((value12 = [
                "object-fit",
                "object-view-box",
                "object-position",
              ].map(
                (input2?: Dynamic): Dynamic => [
                  input2,
                  value15.inlineStyleValue(value16, input2) || null,
                ],
              )),
              (0, runtime.MediaObjectCropTest)(
                (input2?: Dynamic): Dynamic =>
                  value15.inlineStyleValue(value16, input2),
              ))
            )
              for (let value20 of [
                "object-view-box",
                "object-position",
              ] as Dynamic)
                value15.setStyleProperty(value16, value20, null);
            value14 != null && options.src === value14 && (flag2 = true);
            value6();
            return true;
          },
          relocate: (input2?: Dynamic): Dynamic =>
            value3().elementsByAttr("src", input2)[0] ?? null,
          readSrc: (element?: Dynamic): Dynamic => element.getAttribute("src"),
          onSettled: (input2?: Dynamic, options?: Dynamic): Dynamic =>
            value7({
              src: input2,
              attrs: callback(options),
            }),
          previewAttrs: (input2?: Dynamic): Dynamic =>
            value11.pin
              ? {
                  width: String(input2.width),
                  height: String(input2.height),
                  [`${runtime.StyleValue}width`]: `${input2.width}px`,
                  [`${runtime.StyleValue}height`]: "auto",
                  [`${runtime.StyleValue}aspect-ratio`]: `${input2.width} / ${input2.height}`,
                }
              : {},
          revertAttrs: state,
          yieldCleanupAttrs: value11.pin
            ? {
                width: null,
                height: null,
                [`${runtime.StyleValue}width`]: null,
                [`${runtime.StyleValue}height`]: null,
                [`${runtime.StyleValue}aspect-ratio`]: null,
              }
            : {},
          placeholderSrc: attribute ?? "",
          swapOverPlaceholder: false,
        })) > 0,
      relName: value13,
      src: value14,
      applied: flag2,
    };
  }
  bindRuntimeValue(runtime, "imageElementSizing", () => imageElementSizing);
  bindRuntimeValue(runtime, "replaceSelectedImage", () => replaceSelectedImage);
  return () => {};
}
