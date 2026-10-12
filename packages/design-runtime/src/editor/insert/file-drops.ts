/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInsertFileDrops(
  runtime: RuntimeBindings,
): () => void {
  var StyleValue: Dynamic;
  var InsertFileDropsConstant: Dynamic;
  function createDropMarker(input?: Dynamic): Dynamic {
    return `${input}#drop${++InsertFileDropsConstant}`;
  }
  async function insertUploadedFiles(input?: Dynamic): Promise<Dynamic> {
    let {
        files: value,
        targets: value2,
        upload: value3,
        preview: value4,
        patch: value5,
        relocate: value6,
        relocateByMarker: value7,
        markerCleanupAttrs: value8,
        placeholderSrc: value9,
        swapOverPlaceholder: value10,
        readSrc: value11,
        onSettled: value12,
        onStage: value13,
        preApplied: value14,
        previewAttrs: value15,
        revertAttrs: value16,
        yieldCleanupAttrs: value17,
        insertPinned: value18,
      }: Dynamic = input,
      value19: Dynamic = Date.now(),
      callback: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        try {
          value13?.(input2, options, Date.now() - value19, context);
        } catch {}
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof value17 == "function"
          ? value17(input2)
          : (value17 ?? {
              width: null,
              height: null,
            }),
      index: Dynamic = 0;
    await Promise.all(
      value.map(
        async (input2?: Dynamic, options?: Dynamic): Promise<Dynamic> => {
          let value20: Dynamic = value2[options];
          if (value20 == null) return;
          let value21: Dynamic = value14?.[options]?.src ?? null,
            callback3: Dynamic = (input3?: Dynamic): Dynamic => {
              if (value5(value20, input3)) return true;
              let value22: Dynamic = value21 == null ? null : value6(value21);
              value22 ??= value7?.(options) ?? null;
              return value22 == null
                ? false
                : ((value20 = value22), value5(value22, input3));
            },
            flag: Dynamic = false;
          value21 != null
            ? callback("preview", true, options)
            : value4(input2)
                .then((input3?: Dynamic): Dynamic => {
                  if (input3 != null && !flag) {
                    let value22: Dynamic = createDropMarker(input3.url),
                      value23: Dynamic = value15?.(input3, options) ?? {
                        width: String(input3.width),
                        height: String(input3.height),
                      };
                    callback3({
                      ...value23,
                      src: value22,
                    }) && (value21 = value22);
                    callback("preview", value21 != null, options);
                  } else flag || callback("preview", false, options);
                })
                .catch((): Dynamic => {
                  callback("preview", false, options);
                });
          try {
            let { src: value22, base: value23 }: Dynamic = await value3(input2);
            flag = true;
            let value24: Dynamic = value7?.(options);
            value24 != null && (value20 = value24);
            let value25: Dynamic = value8?.(options) ?? {},
              state: Dynamic = {
                ...value25,
                src: value22,
                alt: value23,
              };
            value21 != null && value12?.(value21, state);
            let value26: Dynamic = value11(value20);
            value26 == null ||
            value26 === value21 ||
            (((value10 ?? true) || value21 == null) && value26 === value9)
              ? callback("swap", callback3(state), options)
              : value21 != null || (value18?.(options) ?? false)
                ? (callback3({
                    ...callback2(options),
                    ...value25,
                  }),
                  callback("swap", true, options))
                : (Object.keys(value25).length > 0 && callback3(value25),
                  callback("swap", true, options));
          } catch (value22: Dynamic) {
            flag = true;
            try {
              let value23: Dynamic = value7?.(options);
              value23 != null && (value20 = value23);
              let value24: Dynamic = value8?.(options) ?? {},
                state: Dynamic = {
                  width: null,
                  height: null,
                  ...(typeof value16 == "function"
                    ? value16(options)
                    : value16),
                  ...value24,
                  src: value9,
                };
              value21 != null && value12?.(value21, state);
              let value25: Dynamic = value11(value20);
              value25 == null ||
              value25 === value21 ||
              (value21 == null && value25 === value9)
                ? callback("revert", callback3(state), options)
                : value21 != null || (value18?.(options) ?? false)
                  ? (callback3({
                      ...callback2(options),
                      ...value24,
                    }),
                    callback("revert", true, options))
                  : (Object.keys(value24).length > 0 && callback3(value24),
                    callback("revert", true, options));
            } catch (value23: Dynamic) {
              console.error("[dc-editor] image drop revert failed:", value23);
              callback("revert", false, options);
            }
            index += 1;
            console.error("[dc-editor] image drop upload failed:", value22);
          }
        },
      ),
    );
    return index;
  }
  bindRuntimeValue(
    runtime,
    "StyleValue",
    () => StyleValue,
    (value) => {
      StyleValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InsertFileDropsConstant",
    () => InsertFileDropsConstant,
    (value) => {
      InsertFileDropsConstant = value;
    },
  );
  bindRuntimeValue(runtime, "createDropMarker", () => createDropMarker);
  bindRuntimeValue(runtime, "insertUploadedFiles", () => insertUploadedFiles);
  return () => {
    StyleValue = "style.";
    InsertFileDropsConstant = 0;
  };
}
