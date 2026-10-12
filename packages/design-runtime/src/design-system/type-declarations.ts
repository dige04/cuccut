/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemTypeDeclarations(
  runtime: RuntimeBindings,
): () => void {
  var DesignSystemTypeDeclarationsRegistry: Dynamic;
  var DesignSystemTypeDeclarationsAlias: Dynamic;
  var DesignSystemTypeDeclarationsFailedValue: Dynamic;
  var DesignSystemTypeDeclarationsResolvedValue: Dynamic;
  var DesignSystemTypeDeclarationsAlias_2: Dynamic;
  var DesignSystemTypeDeclarationsSubscribers: Dynamic;
  var pendingFileOverlay: Dynamic;
  var DesignSystemTypeDeclarationsItems: Dynamic;
  var DesignSystemTypeDeclarationsResolvedValue_2: Dynamic;
  var DesignSystemTypeDeclarationsFailedValue_2: Dynamic;
  var DesignSystemTypeDeclarationsResolvedValue_3: Dynamic;
  var DesignSystemTypeDeclarationsTextEncoder: Dynamic;
  var DesignSystemTypeDeclarationsReduce: Dynamic;
  var DesignSystemTypeDeclarationsResolvedValue_4: Dynamic;
  var ApplicationJsonValue: Dynamic;
  var DesignSystemTypeDeclarationsDelayMs: Dynamic;
  var DesignSystemTypeDeclarationsCache: Dynamic;
  var DesignSystemTypeDeclarationsCache_2: Dynamic;
  var DesignSystemTypeDeclarationsSubscribers_2: Dynamic;
  var DesignSystemTypeDeclarationsCache_3: Dynamic;
  var DesignSystemTypeDeclarationsLimit: Dynamic;
  var DesignSystemTypeDeclarationsCache_4: Dynamic;
  var DesignSystemTypeDeclarationsAlias_3: Dynamic;
  var DesignSystemTypeDeclarationsSubscribers_3: Dynamic;
  var htmlReferenceUploadWaiters: Dynamic;
  var DesignSystemTypeDeclarationsSubscribers_4: Dynamic;
  var DesignSystemTypeDeclarationsReplace: Dynamic;
  var DesignSystemTypeDeclarationsGet: Dynamic;
  var DesignSystemTypeDeclarationsResolvedValue_5: Dynamic;
  var DesignSystemTypeDeclarationsDelayMs_2: Dynamic;
  var DesignSystemTypeDeclarationsCache_5: Dynamic;
  var DesignSystemTypeDeclarationsCache_6: Dynamic;
  var DesignSystemTypeDeclarationsSubscribers_5: Dynamic;
  var DesignSystemTypeDeclarationsGetLength: Dynamic;
  var DesignSystemsKey: Dynamic;
  var DesignSystemTypeDeclarationsAZaZAZaZPattern: Dynamic;
  var DesignSystemTypeDeclarationsMax: Dynamic;
  var DesignSystemTypeDeclarationsPadStart: Dynamic;
  var DesignSystemTypeDeclarationsPow: Dynamic;
  var PaletteValue: Dynamic;
  var DesignSystemTypeDeclarationsPattern: Dynamic;
  var DesignSystemTypeDeclarationsRgbaHslaPattern: Dynamic;
  var DesignSystemTypeDeclarationsElementCache: Dynamic;
  function getDeclarationFiles(): Dynamic {
    return DesignSystemTypeDeclarationsRegistry;
  }
  function subscribeDeclarationFiles(input?: Dynamic): Dynamic {
    DesignSystemTypeDeclarationsSubscribers.add(input);
    return (): Dynamic => {
      DesignSystemTypeDeclarationsSubscribers.delete(input);
    };
  }
  function setDeclarationReferences(
    items?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = JSON.stringify(items);
    if (value !== DesignSystemTypeDeclarationsAlias)
      if (
        ((DesignSystemTypeDeclarationsAlias = value),
        (DesignSystemTypeDeclarationsRegistry = {}),
        (DesignSystemTypeDeclarationsFailedValue = []),
        (DesignSystemTypeDeclarationsAlias_2 = options),
        options !== undefined && items.length > 0)
      )
        loadTypeDeclarationFiles(value, items, options, 0);
      else
        for (let value2 of DesignSystemTypeDeclarationsSubscribers as Dynamic)
          value2();
  }
  function loadTypeDeclarationFiles(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    (0, runtime.loadReferencedFiles)(options, context).then(
      (input2?: Dynamic): Dynamic => {
        if (DesignSystemTypeDeclarationsAlias !== input) return;
        let value2: Dynamic = Object.entries(input2.files).filter(
          ([, items]: Dynamic): Dynamic =>
            items.length <= runtime.PlatformFileContentResolvedValue_10,
        );
        if (value2.length > 0) {
          DesignSystemTypeDeclarationsRegistry = {
            ...DesignSystemTypeDeclarationsRegistry,
            ...Object.fromEntries(value2),
          };
          for (let value4 of DesignSystemTypeDeclarationsSubscribers as Dynamic)
            value4();
        }
        let value3: Dynamic = DesignSystemTypeDeclarationsItems[value];
        DesignSystemTypeDeclarationsFailedValue = [];
        input2.failed.length > 0 && value3 !== undefined
          ? setTimeout((): Dynamic => {
              DesignSystemTypeDeclarationsAlias === input &&
                loadTypeDeclarationFiles(
                  input,
                  input2.failed,
                  context,
                  value + 1,
                );
            }, value3)
          : input2.failed.length > 0 &&
            ((DesignSystemTypeDeclarationsFailedValue = input2.failed),
            (DesignSystemTypeDeclarationsResolvedValue =
              Date.now() + DesignSystemTypeDeclarationsResolvedValue_2));
      },
    );
  }
  function retryTypeDeclarationFiles(): Dynamic {
    DesignSystemTypeDeclarationsFailedValue.length > 0 &&
      DesignSystemTypeDeclarationsAlias_2 !== undefined &&
      Date.now() >= DesignSystemTypeDeclarationsResolvedValue &&
      ((DesignSystemTypeDeclarationsResolvedValue =
        Date.now() + DesignSystemTypeDeclarationsResolvedValue_2),
      loadTypeDeclarationFiles(
        DesignSystemTypeDeclarationsAlias,
        DesignSystemTypeDeclarationsFailedValue,
        DesignSystemTypeDeclarationsAlias_2,
        DesignSystemTypeDeclarationsItems.length,
      ));
  }
  function hasPendingFileOverlay(): Dynamic {
    return pendingFileOverlay;
  }
  function clearPendingFileOverlay(): Dynamic {
    pendingFileOverlay = false;
  }
  function setPublishedFileReferences(
    input?: Dynamic,
    options: Dynamic = sameOriginFileFetcher(),
  ): Dynamic {
    pendingFileOverlay = true;
    let value: Dynamic = (0, runtime.parseFontFileReferences)(input);
    runtime.PlatformExternalFilesResolvedValue =
      typeof input == "object" && input !== null
        ? Object.keys(input)
            .filter(
              (input2?: Dynamic): Dynamic =>
                input2.startsWith(runtime.ProjectValue),
            )
            .map(
              (input2?: Dynamic): Dynamic =>
                input2.slice(runtime.ProjectValue.length),
            )
        : [];
    runtime.PlatformExternalFilesResolvedValue_2 = value.types ?? [];
    setDeclarationReferences(
      (0, runtime.getTypeDeclarationReferences)(),
      options,
    );
    value.dropped !== undefined &&
      console.warn(
        "design (instance files): not serving " +
          String(value.dropped) +
          " file(s) published under project/ (not a .css/.js/.mjs/.jsx/.tsx/.json support file, over 20 MiB, or past " +
          String(runtime.PlatformFileReferencesLimit) +
          "; or a .d.ts over 2 MiB / past " +
          String(runtime.PlatformFileReferencesLimit_2) +
          ")",
      );
    runtime.PlatformExternalFilesItems = [...value];
    loadInstanceFileReferences(options);
  }
  function setInstanceFileReferences(
    input?: Dynamic,
    options: Dynamic = sameOriginFileFetcher(),
  ): Dynamic {
    runtime.parseFileReferencesValue = (0, runtime.parseFileReferences)(input);
    loadInstanceFileReferences(options);
    retryTypeDeclarationFiles();
  }
  function loadInstanceFileReferences(input?: Dynamic): Dynamic {
    let value: Dynamic = Object.assign(
        [
          ...runtime.PlatformExternalFilesItems,
          ...runtime.parseFileReferencesValue.filter(
            (input2?: Dynamic): Dynamic =>
              !runtime.PlatformExternalFilesItems.some(
                (input3?: Dynamic): Dynamic => input3.path === input2.path,
              ),
          ),
        ].slice(0, runtime.PlatformFileReferencesLimit),
        runtime.parseFileReferencesValue.dropped !== undefined
          ? {
              dropped: runtime.parseFileReferencesValue.dropped,
            }
          : {},
      ),
      value2: Dynamic = JSON.stringify([value, value.dropped ?? 0]);
    if (value2 === runtime.DesignSystemPublishedFilesAlias) {
      DesignSystemTypeDeclarationsFailedValue_2.length > 0 &&
        input !== undefined &&
        Date.now() >= DesignSystemTypeDeclarationsResolvedValue_3 &&
        ((DesignSystemTypeDeclarationsResolvedValue_3 =
          Date.now() + DesignSystemTypeDeclarationsResolvedValue_2),
        loadDesignSystemFileOverlay(
          value2,
          value,
          DesignSystemTypeDeclarationsFailedValue_2,
          DesignSystemTypeDeclarationsItems.length,
          DesignSystemTypeDeclarationsReduce(),
          input,
        ));
      return;
    }
    runtime.DesignSystemPublishedFilesAlias = value2;
    DesignSystemTypeDeclarationsFailedValue_2 = [];
    value.dropped !== undefined &&
      console.warn(
        "design (instance files): ignoring " +
          String(value.dropped) +
          " listed entr" +
          (value.dropped === 1 ? "y" : "ies") +
          " (not a files/ kind of store path, a file outside project/, over 20 MiB, duplicate, or past " +
          String(runtime.PlatformFileReferencesLimit) +
          ")",
      );
    if (input === undefined) return;
    let value3: Dynamic = value.filter(
      (input2?: Dynamic): Dynamic =>
        runtime.DesignSystemPublishedFilesCache.get(input2.path) ===
        input2.file,
    );
    loadDesignSystemFileOverlay(
      value2,
      value,
      value.filter((input2?: Dynamic): Dynamic => !value3.includes(input2)),
      0,
      value3.reduce(
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          input2 +
          DesignSystemTypeDeclarationsTextEncoder.encode(
            runtime.DesignSystemPublishedFilesFromEntriesValue[options.path] ??
              "",
          ).length,
        0,
      ),
      input,
    );
  }
  function loadDesignSystemFileOverlay(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    (0, runtime.loadReferencedFiles)(context, detail, extra).then(
      (input2?: Dynamic): Dynamic => {
        if (runtime.DesignSystemPublishedFilesAlias !== input) return;
        let values: Dynamic = new Set(
            items.map((input3?: Dynamic): Dynamic => input3.path),
          ),
          length: Dynamic = Object.keys(
            runtime.DesignSystemPublishedFilesFromEntriesValue,
          ).length;
        runtime.DesignSystemPublishedFilesFromEntriesValue = Object.fromEntries(
          Object.entries({
            ...runtime.DesignSystemPublishedFilesFromEntriesValue,
            ...input2.files,
          }).filter(([input3]: Dynamic): Dynamic => values.has(input3)),
        );
        for (let value3 of context as Dynamic)
          value3.path in input2.files &&
            runtime.DesignSystemPublishedFilesCache.set(
              value3.path,
              value3.file,
            );
        for (let value3 of [
          ...runtime.DesignSystemPublishedFilesCache.keys(),
        ] as Dynamic)
          value3 in runtime.DesignSystemPublishedFilesFromEntriesValue ||
            runtime.DesignSystemPublishedFilesCache.delete(value3);
        console.info(
          "design (instance files): " +
            String(
              Object.keys(runtime.DesignSystemPublishedFilesFromEntriesValue)
                .length,
            ) +
            " of " +
            String(items.length) +
            " listed file(s) loaded" +
            (input2.skipped > 0
              ? ", " + String(input2.skipped) + " skipped"
              : ""),
        );
        if (
          Object.keys(input2.files).length > 0 ||
          Object.keys(runtime.DesignSystemPublishedFilesFromEntriesValue)
            .length !== length
        )
          for (let value3 of runtime.DesignSystemPublishedFilesSubscribers as Dynamic)
            value3();
        let value2: Dynamic = DesignSystemTypeDeclarationsItems[value];
        DesignSystemTypeDeclarationsFailedValue_2 = [];
        input2.failed.length > 0 && value2 !== undefined
          ? setTimeout((): Dynamic => {
              runtime.DesignSystemPublishedFilesAlias === input &&
                loadDesignSystemFileOverlay(
                  input,
                  items,
                  input2.failed,
                  value + 1,
                  DesignSystemTypeDeclarationsReduce(),
                  detail,
                );
            }, value2)
          : input2.failed.length > 0 &&
            ((DesignSystemTypeDeclarationsFailedValue_2 = input2.failed),
            (DesignSystemTypeDeclarationsResolvedValue_3 =
              Date.now() + DesignSystemTypeDeclarationsResolvedValue_2));
      },
    );
  }
  function sameOriginFileFetcher(): Dynamic {
    return typeof location === "undefined" || typeof fetch === "undefined"
      ? undefined
      : (input?: Dynamic): Dynamic =>
          fetch(input, {
            credentials: "same-origin",
          });
  }
  function isKnownHtmlReference(input?: Dynamic): Dynamic {
    return DesignSystemTypeDeclarationsSubscribers_4.has(
      hashHtmlReference(input),
    );
  }
  function subscribeHtmlReferences(input?: Dynamic): Dynamic {
    DesignSystemTypeDeclarationsSubscribers_3.add(input);
    return (): Dynamic => {
      DesignSystemTypeDeclarationsSubscribers_3.delete(input);
    };
  }
  function hashHtmlReference(items?: Dynamic): Dynamic {
    let value: Dynamic = 3735928559 ^ items.length,
      value2: Dynamic = 1103547991 ^ items.length;
    for (let index: Dynamic = 0; index < items.length; index++) {
      let value3: Dynamic = items.charCodeAt(index);
      value = Math.imul(value ^ value3, 2654435761);
      value2 = Math.imul(value2 ^ value3, 1597334677);
    }
    value =
      (Math.imul(value ^ (value >>> 16), 2246822507) ^
        Math.imul(value2 ^ (value2 >>> 13), 3266489909)) >>>
      0;
    value2 =
      (Math.imul(value2 ^ (value2 >>> 16), 2246822507) ^
        Math.imul(value ^ (value >>> 13), 3266489909)) >>>
      0;
    return (
      value2.toString(16) + value.toString(16) + "." + String(items.length)
    );
  }
  function setHtmlReferenceStore(input?: Dynamic): Dynamic {
    DesignSystemTypeDeclarationsAlias_3 = input;
  }
  function getReferencedHtml(input?: Dynamic): Dynamic {
    return DesignSystemTypeDeclarationsCache.get(
      DesignSystemTypeDeclarationsReplace(input),
    );
  }
  function getArtboardHtmlReference(input?: Dynamic): Dynamic {
    return DesignSystemTypeDeclarationsCache_4.get(input);
  }
  function htmlReferenceForText(input?: Dynamic): Dynamic {
    let entry: Dynamic = DesignSystemTypeDeclarationsCache_2.get(
      hashHtmlReference(input),
    );
    return entry !== undefined &&
      DesignSystemTypeDeclarationsCache.get(entry) === input
      ? entry
      : undefined;
  }
  function getHtmlReferenceState(): Dynamic {
    return DesignSystemTypeDeclarationsResolvedValue_5;
  }
  function cacheReferencedHtml(input?: Dynamic, options?: Dynamic): Dynamic {
    DesignSystemTypeDeclarationsCache.set(
      DesignSystemTypeDeclarationsReplace(input),
      options,
    );
    DesignSystemTypeDeclarationsCache_2.set(
      hashHtmlReference(options),
      DesignSystemTypeDeclarationsReplace(input),
    );
  }
  function setArtboardHtmlReferences(
    input?: Dynamic,
    options: Dynamic = sameOriginAssetFetcher(),
  ): Dynamic {
    let entries: Dynamic = new Map();
    for (let [value, value2] of input as Dynamic)
      (0, runtime.isBlobAssetUrl)(value2.ref) &&
        (DesignSystemTypeDeclarationsCache_4.set(value, {
          ref: DesignSystemTypeDeclarationsReplace(value2.ref),
          bytes: value2.bytes,
        }),
        entries.set(
          DesignSystemTypeDeclarationsReplace(value2.ref),
          value2.ref,
        ));
    if (options !== undefined)
      for (let [
        value,
        { ref: value2 },
      ] of DesignSystemTypeDeclarationsCache_4 as Dynamic)
        DesignSystemTypeDeclarationsCache.has(value2) ||
          DesignSystemTypeDeclarationsSubscribers_2.has(value2) ||
          DesignSystemTypeDeclarationsGet(value2) ||
          (DesignSystemTypeDeclarationsSubscribers_2.add(value2),
          fetchHtmlReference(entries.get(value2) ?? value2, options).then(
            (input2?: Dynamic): Dynamic => {
              DesignSystemTypeDeclarationsSubscribers_2.delete(value2);
              if (input2 === undefined) {
                DesignSystemTypeDeclarationsCache_3.set(value2, Date.now());
                clearTimeout(htmlReferenceUploadWaiters);
                htmlReferenceUploadWaiters = setTimeout(
                  (): Dynamic =>
                    setArtboardHtmlReferences(
                      new Map(DesignSystemTypeDeclarationsCache_4),
                      options,
                    ),
                  DesignSystemTypeDeclarationsLimit + 50,
                );
                return;
              }
              DesignSystemTypeDeclarationsCache_3.delete(value2);
              cacheReferencedHtml(value2, input2);
              let value3: Dynamic = [...DesignSystemTypeDeclarationsCache_4]
                .filter(([, input3]: Dynamic): Dynamic => input3.ref === value2)
                .map(([input3]: Dynamic): Dynamic => input3);
              for (let value4 of value3 as Dynamic)
                DesignSystemTypeDeclarationsAlias_3?.hydrate(value4, input2);
              for (let value4 of DesignSystemTypeDeclarationsSubscribers_3 as Dynamic)
                value4(value3);
            },
          ));
  }
  async function fetchHtmlReference(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value: Dynamic,
        value2: Dynamic = await Promise.race([
          options(input),
          new Promise((input2?: Dynamic, options2?: Dynamic): Dynamic => {
            value = setTimeout(
              (): Dynamic => options2(new Error("timeout")),
              DesignSystemTypeDeclarationsDelayMs,
            );
          }),
        ]).finally((): Dynamic => clearTimeout(value));
      if (!value2.ok) throw new Error("not found");
      let value3: Dynamic = await value2.text();
      if (
        DesignSystemTypeDeclarationsGetLength(value3) >
        DesignSystemTypeDeclarationsResolvedValue_4
      )
        throw new Error(
          "over " +
            String(DesignSystemTypeDeclarationsResolvedValue_4) +
            " bytes",
        );
      let value4: Dynamic = JSON.parse(value3);
      if (
        value4 === null ||
        typeof value4 != "object" ||
        typeof value4.html != "string"
      )
        throw new Error("not a board blob");
      return value4.html;
    } catch (value: Dynamic) {
      console.warn(
        "design (board blob): could not read " +
          input +
          ": " +
          String(value).slice(0, 120),
      );
      return;
    }
  }
  function scheduleHtmlUpload(input?: Dynamic, options?: Dynamic): Dynamic {
    htmlReferenceForText(options) === undefined &&
      (DesignSystemTypeDeclarationsCache_5.set(input, options),
      clearTimeout(DesignSystemTypeDeclarationsCache_6.get(input)),
      DesignSystemTypeDeclarationsCache_6.set(
        input,
        setTimeout((): Dynamic => {
          publishHtmlReference(input);
        }, DesignSystemTypeDeclarationsDelayMs_2),
      ));
  }
  async function publishHtmlReference(input?: Dynamic): Promise<Dynamic> {
    DesignSystemTypeDeclarationsCache_6.delete(input);
    let entry: Dynamic = DesignSystemTypeDeclarationsCache_5.get(input);
    if (
      entry === undefined ||
      DesignSystemTypeDeclarationsSubscribers_5.has(input)
    )
      return;
    let value: Dynamic = hashHtmlReference(entry);
    if (htmlReferenceForText(entry) !== undefined) {
      DesignSystemTypeDeclarationsAlias_3?.resync();
      return;
    }
    if (DesignSystemTypeDeclarationsSubscribers_4.has(value)) return;
    if (DesignSystemTypeDeclarationsGet(value)) {
      DesignSystemTypeDeclarationsCache_6.set(
        input,
        setTimeout(
          (): Dynamic => {
            publishHtmlReference(input);
          },
          DesignSystemTypeDeclarationsLimit -
            (Date.now() -
              (DesignSystemTypeDeclarationsCache_3.get(value) ?? 0)) +
            50,
        ),
      );
      return;
    }
    let value2: Dynamic = JSON.stringify({
      v: 1,
      path: input,
      html: entry,
    });
    if (
      DesignSystemTypeDeclarationsGetLength(value2) >
      DesignSystemTypeDeclarationsResolvedValue_4
    ) {
      DesignSystemTypeDeclarationsSubscribers_4.add(value);
      DesignSystemTypeDeclarationsAlias_3?.resync();
      return;
    }
    DesignSystemTypeDeclarationsSubscribers_5.add(input);
    try {
      let value3: Dynamic = await (0, runtime.getAssetsCapability)();
      DesignSystemTypeDeclarationsResolvedValue_5 =
        value3 === null || typeof value3.upload != "function";
      if (value3 === null || typeof value3.upload != "function")
        throw (
          DesignSystemTypeDeclarationsAlias_3?.resync(),
          new Error("this view cannot upload")
        );
      let value4: Dynamic = await value3.upload(
          new Blob([value2], {
            type: ApplicationJsonValue,
          }),
          {
            type: ApplicationJsonValue,
          },
        ),
        value5: Dynamic =
          typeof value4?.url == "string" &&
          (0, runtime.isBlobAssetUrl)(value4.url)
            ? value4.url
            : typeof value4?.id == "string"
              ? "_blob/" + value4.id
              : undefined;
      if (value5 === undefined || !(0, runtime.isBlobAssetUrl)(value5))
        throw new Error("upload returned no usable reference");
      cacheReferencedHtml(value5, entry);
      DesignSystemTypeDeclarationsAlias_3?.resync();
    } catch (value3: Dynamic) {
      DesignSystemTypeDeclarationsCache_3.set(value, Date.now());
      console.warn(
        "design (board blob): upload of " +
          input +
          " failed: " +
          String(value3).slice(0, 120),
      );
      !DesignSystemTypeDeclarationsResolvedValue_5 &&
        !DesignSystemTypeDeclarationsCache_6.has(input) &&
        DesignSystemTypeDeclarationsCache_6.set(
          input,
          setTimeout((): Dynamic => {
            publishHtmlReference(input);
          }, DesignSystemTypeDeclarationsLimit + 50),
        );
    } finally {
      DesignSystemTypeDeclarationsSubscribers_5.delete(input);
      DesignSystemTypeDeclarationsCache_5.get(input) !== entry &&
        !DesignSystemTypeDeclarationsCache_6.has(input) &&
        DesignSystemTypeDeclarationsCache_6.set(
          input,
          setTimeout((): Dynamic => {
            publishHtmlReference(input);
          }, DesignSystemTypeDeclarationsDelayMs_2),
        );
    }
  }
  function knownHtmlReferenceState(input?: Dynamic): Dynamic {
    return DesignSystemTypeDeclarationsGet(hashHtmlReference(input));
  }
  function sameOriginAssetFetcher(): Dynamic {
    return typeof location === "undefined" || typeof fetch === "undefined"
      ? undefined
      : (input?: Dynamic): Dynamic =>
          fetch(input, {
            credentials: "same-origin",
          });
  }
  function cssColorNumber(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input === "none") return 0;
    let value: Dynamic = /^(-?\d*\.?\d+(?:e-?\d+)?)(%?)$/.exec(input);
    if (value !== null)
      return value[2] === "%"
        ? (Number(value[1]) / 100) * options
        : Number(value[1]);
  }
  function cssColorAngle(input?: Dynamic): Dynamic {
    let value: Dynamic = /^(-?\d*\.?\d+)(deg|rad|grad|turn)?$/.exec(
      input === "none" ? "0" : input,
    );
    return value === null
      ? undefined
      : (((Number(value[1]) *
          (value[2] === "rad"
            ? 180 / Math.PI
            : value[2] === "grad"
              ? 0.9
              : value[2] === "turn"
                ? 360
                : 1)) %
          360) +
          360) %
          360;
  }
  function parseColorFunction(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = new RegExp("^" + options + "\\((.*)\\)$").exec(input);
    if (value === null) return;
    let value2: Dynamic = value[1].trim().split(/\s*[,/]\s*|\s+/);
    return value2.length === 3 || value2.length === 4 ? value2 : undefined;
  }
  function oklabToCssRgb(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
        (input + 0.3963377774 * options + 0.2158037573 * context) ** 3,
      value2: Dynamic =
        (input - 0.1055613458 * options - 0.0638541728 * context) ** 3,
      value3: Dynamic =
        (input - 0.0894841775 * options - 1.291485548 * context) ** 3;
    return [
      DesignSystemTypeDeclarationsPow(
        4.0767416621 * value - 3.3077115913 * value2 + 0.2309699292 * value3,
      ),
      DesignSystemTypeDeclarationsPow(
        -1.2684380046 * value + 2.6097574011 * value2 - 0.3413193965 * value3,
      ),
      DesignSystemTypeDeclarationsPow(
        -0.0041960863 * value - 0.7034186147 * value2 + 1.707614701 * value3,
      ),
    ];
  }
  function labToCssRgb(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (input + 16) / 116,
      value2: Dynamic = value + options / 500,
      value3: Dynamic = value - context / 200,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 ** 3 > 216 / 24389
          ? input2 ** 3
          : (116 * input2 - 16) / (24389 / 27),
      [items, items2, items3]: Dynamic = [
        callback(value2) * 0.96422,
        (input > 8 ? value ** 3 : input / (24389 / 27)) * 1,
        callback(value3) * 0.82521,
      ],
      value4: Dynamic =
        0.9555766 * items - 0.0230393 * items2 + 0.0631636 * items3,
      value5: Dynamic =
        -0.0282895 * items + 1.0099416 * items2 + 0.0210077 * items3,
      value6: Dynamic =
        0.0122982 * items - 0.020483 * items2 + 1.3299098 * items3;
    return [
      DesignSystemTypeDeclarationsPow(
        3.2404542 * value4 - 1.5371385 * value5 - 0.4985314 * value6,
      ),
      DesignSystemTypeDeclarationsPow(
        -0.969266 * value4 + 1.8760108 * value5 + 0.041556 * value6,
      ),
      DesignSystemTypeDeclarationsPow(
        0.0556434 * value4 - 0.2040259 * value5 + 1.0572252 * value6,
      ),
    ];
  }
  function normalizeCssColor(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trim().toLowerCase();
    if (value.length > 96) return;
    let value2: Dynamic = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(
      value,
    )?.[1];
    if (value2 !== undefined) {
      let value8: Dynamic =
        value2.length <= 4
          ? [...value2]
              .map((input2?: Dynamic): Dynamic => input2 + input2)
              .join("")
          : value2;
      return (
        "#" +
        (value8.endsWith("ff") && value8.length === 8
          ? value8.slice(0, 6)
          : value8)
      );
    }
    let value3: Dynamic = /^(rgba?|hsla?|oklch|oklab|lab|lch)\(/.exec(
        value,
      )?.[1],
      value4: Dynamic =
        value3 !== undefined ? parseColorFunction(value, value3) : undefined;
    if (value3 === undefined || value4 === undefined) return;
    let value5: Dynamic =
        value4[3] !== undefined ? cssColorNumber(value4[3], 1) : 1,
      value6: Dynamic;
    if (value3 === "rgb" || value3 === "rgba") {
      let [items, items2, items3]: Dynamic = [
        cssColorNumber(value4[0], 255),
        cssColorNumber(value4[1], 255),
        cssColorNumber(value4[2], 255),
      ];
      items !== undefined &&
        items2 !== undefined &&
        items3 !== undefined &&
        (value6 = [items / 255, items2 / 255, items3 / 255]);
    } else if (value3 === "hsl" || value3 === "hsla") {
      let [items, items2, items3]: Dynamic = [
        cssColorAngle(value4[0]),
        cssColorNumber(value4[1].replace(/%$/, ""), 100),
        cssColorNumber(value4[2].replace(/%$/, ""), 100),
      ];
      if (items !== undefined && items2 !== undefined && items3 !== undefined) {
        let [items4, items5]: Dynamic = [
            DesignSystemTypeDeclarationsMax(items2 / 100),
            DesignSystemTypeDeclarationsMax(items3 / 100),
          ],
          callback: Dynamic = (input2?: Dynamic): Dynamic => {
            let value8: Dynamic = (input2 + items / 30) % 12;
            return (
              items5 -
              items4 *
                Math.min(items5, 1 - items5) *
                Math.max(-1, Math.min(value8 - 3, 9 - value8, 1))
            );
          };
        value6 = [callback(0), callback(8), callback(4)];
      }
    } else if (value3 === "oklab" || value3 === "oklch") {
      let value8: Dynamic = cssColorNumber(value4[0], 1),
        value9: Dynamic = cssColorNumber(value4[1], 0.4),
        value10: Dynamic =
          value3 === "oklab" ? cssColorNumber(value4[2], 0.4) : undefined;
      if (value3 === "oklch") {
        let value11: Dynamic = cssColorAngle(value4[2]);
        value9 !== undefined &&
          value11 !== undefined &&
          ([value9, value10] = [
            Math.max(0, value9) * Math.cos((value11 * Math.PI) / 180),
            Math.max(0, value9) * Math.sin((value11 * Math.PI) / 180),
          ]);
      }
      value8 !== undefined &&
        value9 !== undefined &&
        value10 !== undefined &&
        (value6 = oklabToCssRgb(
          DesignSystemTypeDeclarationsMax(value8),
          value9,
          value10,
        ));
    } else {
      let value8: Dynamic = cssColorNumber(value4[0], 100),
        value9: Dynamic = cssColorNumber(
          value4[1],
          value3 === "lab" ? 125 : 150,
        ),
        value10: Dynamic =
          value3 === "lab" ? cssColorNumber(value4[2], 125) : undefined;
      if (value3 === "lch") {
        let value11: Dynamic = cssColorAngle(value4[2]);
        value9 !== undefined &&
          value11 !== undefined &&
          ([value9, value10] = [
            Math.max(0, value9) * Math.cos((value11 * Math.PI) / 180),
            Math.max(0, value9) * Math.sin((value11 * Math.PI) / 180),
          ]);
      }
      value8 !== undefined &&
        value9 !== undefined &&
        value10 !== undefined &&
        (value6 = labToCssRgb(
          Math.max(0, Math.min(100, value8)),
          value9,
          value10,
        ));
    }
    if (
      value6 === undefined ||
      value5 === undefined ||
      value6.some((input2?: Dynamic): Dynamic => !Number.isFinite(input2))
    )
      return;
    let value7: Dynamic =
      "#" +
      DesignSystemTypeDeclarationsPadStart(value6[0]) +
      DesignSystemTypeDeclarationsPadStart(value6[1]) +
      DesignSystemTypeDeclarationsPadStart(value6[2]);
    return value5 >= 1
      ? value7
      : value7 + DesignSystemTypeDeclarationsPadStart(value5);
  }
  function sharedColorTokenPrefix(items?: Dynamic): Dynamic {
    if (items.length < 2) return "";
    let value: Dynamic = items[0],
      text: Dynamic = "";
    for (
      let value2: Dynamic = value.indexOf("-");
      value2 > 0;
      value2 = value.indexOf("-", value2 + 1)
    ) {
      let value3: Dynamic = value.slice(0, value2 + 1);
      if (
        !items.every(
          (items2?: Dynamic): Dynamic =>
            items2.startsWith(value3) && items2.length > value3.length,
        )
      )
        break;
      items.some(
        (input?: Dynamic): Dynamic => hasColorTokenGroup(input, value3),
      ) && (text = value3);
    }
    return text;
  }
  function colorTokenGroup(items?: Dynamic, items2: Dynamic = ""): Dynamic {
    let value: Dynamic =
        items2 !== "" &&
        items.startsWith(items2) &&
        items.length > items2.length
          ? items.slice(items2.length)
          : items,
      value2: Dynamic = DesignSystemTypeDeclarationsPattern.exec(value);
    if (value2 !== null && value2[1] !== undefined && value2[1] !== "")
      return value2[1];
    let value3: Dynamic = value.indexOf("-");
    return value3 > 0 ? value.slice(0, value3) : value;
  }
  function hasColorTokenGroup(items?: Dynamic, items2: Dynamic = ""): Dynamic {
    let value: Dynamic =
      items2 !== "" && items.startsWith(items2) && items.length > items2.length
        ? items.slice(items2.length)
        : items;
    return colorTokenGroup(items, items2) !== value;
  }
  function groupColorTokens(input?: Dynamic): Dynamic {
    let value: Dynamic = sharedColorTokenPrefix(input),
      entries: Dynamic = new Map();
    for (let value2 of input as Dynamic) {
      let value3: Dynamic = colorTokenGroup(value2, value),
        entry: Dynamic = entries.get(value3);
      entry === undefined && entries.set(value3, (entry = []));
      entry.push(value2);
    }
    let items: Dynamic = [],
      items2: Dynamic = [];
    for (let [value2, value3] of entries as Dynamic)
      value3.some(
        (input2?: Dynamic): Dynamic => hasColorTokenGroup(input2, value),
      )
        ? items.push({
            label: value2,
            names: value3,
          })
        : items2.push(...value3);
    let entries2: Dynamic = new Map(
      input.map(
        (input2?: Dynamic, options?: Dynamic): Dynamic => [input2, options],
      ),
    );
    items2.sort(
      (input2?: Dynamic, options?: Dynamic): Dynamic =>
        (entries2.get(input2) ?? 0) - (entries2.get(options) ?? 0),
    );
    return items2.length > 0
      ? [
          {
            label: PaletteValue,
            names: items2,
          },
          ...items,
        ]
      : items;
  }
  function normalizeColorTokenName(input?: Dynamic): Dynamic {
    if (typeof input != "string") return;
    let value: Dynamic = input.replace(/^(--|\.)/, "");
    return DesignSystemTypeDeclarationsAZaZAZaZPattern.test(value)
      ? value
      : undefined;
  }
  function boundedDesignSystemText(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (typeof input != "string" || input.trim() === "") return;
    let value: Dynamic = input.trim();
    return value.length > options
      ? Array.from(value).slice(0, options).join("")
      : value;
  }
  function designSystemName(input?: Dynamic): Dynamic {
    return boundedDesignSystemText(input?.name, 80);
  }
  function createDesignSystemModel(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    items?: Dynamic,
    items2: Dynamic = [],
  ): Dynamic {
    if (items.length === 0 && items2.length === 0) return;
    let value: Dynamic = boundedDesignSystemText(options, 2e3),
      value2: Dynamic = boundedDesignSystemText(context, 80);
    return {
      title: boundedDesignSystemText(input, 80) ?? "Design system",
      ...(value !== undefined && /^https:\/\//.test(value)
        ? {
            url: value,
          }
        : {}),
      ...(value2 !== undefined
        ? {
            theme: value2,
          }
        : {}),
      colors: items,
      ...(items2.length > 0
        ? {
            type: items2,
          }
        : {}),
    };
  }
  function colorTokenGroupLabels(input?: Dynamic, options?: Dynamic): Dynamic {
    return hasSingleColorGroup(input)
      ? {
          group: input.title,
        }
      : {
          group: input.title,
          subgroup: options.group,
        };
  }
  function hasSingleColorGroup(input?: Dynamic): Dynamic {
    let entry: Dynamic = DesignSystemTypeDeclarationsElementCache.get(input);
    entry === undefined &&
      DesignSystemTypeDeclarationsElementCache.set(
        input,
        (entry = input.colors.every(
          (input2?: Dynamic): Dynamic => input2.group === input.colors[0].group,
        )),
      );
    return entry;
  }
  function typographyGroupLabels(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.type ?? [];
    return value.every(
      (input2?: Dynamic): Dynamic => input2.group === value[0].group,
    )
      ? {
          group: input.title,
        }
      : {
          group: input.title,
          subgroup: options.group,
        };
  }
  function parseDesignSystemEntry(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return;
    let value: Dynamic = input;
    return (0, runtime.parseCompleteDesignSystem)(value.tokens, {
      title: boundedDesignSystemText(value.title, 80),
      url: boundedDesignSystemText(value.url, 2e3),
    });
  }
  function parseDesignSystems(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return [];
    let value: Dynamic = input;
    if (
      value.systems === undefined &&
      ((typeof value.color == "object" && value.color !== null) ||
        (typeof value.type == "object" && value.type !== null))
    )
      return parseDesignSystems({
        v: 1,
        systems: [
          {
            tokens: input,
          },
        ],
      });
    if (
      (value.v !== undefined && value.v !== 1) ||
      !Array.isArray(value.systems)
    )
      return [];
    let value2: Dynamic = value.systems
        .map(parseDesignSystemEntry)
        .filter((input2?: Dynamic): Dynamic => input2 !== undefined),
      items: Dynamic = [];
    for (let value3 of value2 as Dynamic) {
      if (items.length >= 4) break;
      let title: Dynamic = value3.title;
      for (
        let count: Dynamic = 2;
        items.some((input2?: Dynamic): Dynamic => input2.title === title) ||
        (title !== value3.title &&
          value2.some((input2?: Dynamic): Dynamic => input2.title === title));
        count++
      )
        title = value3.title + " " + String(count);
      items.push(
        title === value3.title
          ? value3
          : {
              ...value3,
              title: title,
            },
      );
    }
    return items;
  }
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsRegistry",
    () => DesignSystemTypeDeclarationsRegistry,
    (value) => {
      DesignSystemTypeDeclarationsRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsAlias",
    () => DesignSystemTypeDeclarationsAlias,
    (value) => {
      DesignSystemTypeDeclarationsAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsFailedValue",
    () => DesignSystemTypeDeclarationsFailedValue,
    (value) => {
      DesignSystemTypeDeclarationsFailedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsResolvedValue",
    () => DesignSystemTypeDeclarationsResolvedValue,
    (value) => {
      DesignSystemTypeDeclarationsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsAlias_2",
    () => DesignSystemTypeDeclarationsAlias_2,
    (value) => {
      DesignSystemTypeDeclarationsAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsSubscribers",
    () => DesignSystemTypeDeclarationsSubscribers,
    (value) => {
      DesignSystemTypeDeclarationsSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "getDeclarationFiles", () => getDeclarationFiles);
  bindRuntimeValue(
    runtime,
    "subscribeDeclarationFiles",
    () => subscribeDeclarationFiles,
  );
  bindRuntimeValue(
    runtime,
    "setDeclarationReferences",
    () => setDeclarationReferences,
  );
  bindRuntimeValue(
    runtime,
    "loadTypeDeclarationFiles",
    () => loadTypeDeclarationFiles,
  );
  bindRuntimeValue(
    runtime,
    "retryTypeDeclarationFiles",
    () => retryTypeDeclarationFiles,
  );
  bindRuntimeValue(
    runtime,
    "pendingFileOverlay",
    () => pendingFileOverlay,
    (value) => {
      pendingFileOverlay = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasPendingFileOverlay",
    () => hasPendingFileOverlay,
  );
  bindRuntimeValue(
    runtime,
    "clearPendingFileOverlay",
    () => clearPendingFileOverlay,
  );
  bindRuntimeValue(
    runtime,
    "setPublishedFileReferences",
    () => setPublishedFileReferences,
  );
  bindRuntimeValue(
    runtime,
    "setInstanceFileReferences",
    () => setInstanceFileReferences,
  );
  bindRuntimeValue(
    runtime,
    "loadInstanceFileReferences",
    () => loadInstanceFileReferences,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsItems",
    () => DesignSystemTypeDeclarationsItems,
    (value) => {
      DesignSystemTypeDeclarationsItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsResolvedValue_2",
    () => DesignSystemTypeDeclarationsResolvedValue_2,
    (value) => {
      DesignSystemTypeDeclarationsResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsFailedValue_2",
    () => DesignSystemTypeDeclarationsFailedValue_2,
    (value) => {
      DesignSystemTypeDeclarationsFailedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsResolvedValue_3",
    () => DesignSystemTypeDeclarationsResolvedValue_3,
    (value) => {
      DesignSystemTypeDeclarationsResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsTextEncoder",
    () => DesignSystemTypeDeclarationsTextEncoder,
    (value) => {
      DesignSystemTypeDeclarationsTextEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsReduce",
    () => DesignSystemTypeDeclarationsReduce,
    (value) => {
      DesignSystemTypeDeclarationsReduce = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loadDesignSystemFileOverlay",
    () => loadDesignSystemFileOverlay,
  );
  bindRuntimeValue(
    runtime,
    "sameOriginFileFetcher",
    () => sameOriginFileFetcher,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsResolvedValue_4",
    () => DesignSystemTypeDeclarationsResolvedValue_4,
    (value) => {
      DesignSystemTypeDeclarationsResolvedValue_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ApplicationJsonValue",
    () => ApplicationJsonValue,
    (value) => {
      ApplicationJsonValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsDelayMs",
    () => DesignSystemTypeDeclarationsDelayMs,
    (value) => {
      DesignSystemTypeDeclarationsDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsCache",
    () => DesignSystemTypeDeclarationsCache,
    (value) => {
      DesignSystemTypeDeclarationsCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsCache_2",
    () => DesignSystemTypeDeclarationsCache_2,
    (value) => {
      DesignSystemTypeDeclarationsCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsSubscribers_2",
    () => DesignSystemTypeDeclarationsSubscribers_2,
    (value) => {
      DesignSystemTypeDeclarationsSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsCache_3",
    () => DesignSystemTypeDeclarationsCache_3,
    (value) => {
      DesignSystemTypeDeclarationsCache_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsLimit",
    () => DesignSystemTypeDeclarationsLimit,
    (value) => {
      DesignSystemTypeDeclarationsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsCache_4",
    () => DesignSystemTypeDeclarationsCache_4,
    (value) => {
      DesignSystemTypeDeclarationsCache_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsAlias_3",
    () => DesignSystemTypeDeclarationsAlias_3,
    (value) => {
      DesignSystemTypeDeclarationsAlias_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsSubscribers_3",
    () => DesignSystemTypeDeclarationsSubscribers_3,
    (value) => {
      DesignSystemTypeDeclarationsSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "htmlReferenceUploadWaiters",
    () => htmlReferenceUploadWaiters,
    (value) => {
      htmlReferenceUploadWaiters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsSubscribers_4",
    () => DesignSystemTypeDeclarationsSubscribers_4,
    (value) => {
      DesignSystemTypeDeclarationsSubscribers_4 = value;
    },
  );
  bindRuntimeValue(runtime, "isKnownHtmlReference", () => isKnownHtmlReference);
  bindRuntimeValue(
    runtime,
    "subscribeHtmlReferences",
    () => subscribeHtmlReferences,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsReplace",
    () => DesignSystemTypeDeclarationsReplace,
    (value) => {
      DesignSystemTypeDeclarationsReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsGet",
    () => DesignSystemTypeDeclarationsGet,
    (value) => {
      DesignSystemTypeDeclarationsGet = value;
    },
  );
  bindRuntimeValue(runtime, "hashHtmlReference", () => hashHtmlReference);
  bindRuntimeValue(
    runtime,
    "setHtmlReferenceStore",
    () => setHtmlReferenceStore,
  );
  bindRuntimeValue(runtime, "getReferencedHtml", () => getReferencedHtml);
  bindRuntimeValue(
    runtime,
    "getArtboardHtmlReference",
    () => getArtboardHtmlReference,
  );
  bindRuntimeValue(runtime, "htmlReferenceForText", () => htmlReferenceForText);
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsResolvedValue_5",
    () => DesignSystemTypeDeclarationsResolvedValue_5,
    (value) => {
      DesignSystemTypeDeclarationsResolvedValue_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getHtmlReferenceState",
    () => getHtmlReferenceState,
  );
  bindRuntimeValue(runtime, "cacheReferencedHtml", () => cacheReferencedHtml);
  bindRuntimeValue(
    runtime,
    "setArtboardHtmlReferences",
    () => setArtboardHtmlReferences,
  );
  bindRuntimeValue(runtime, "fetchHtmlReference", () => fetchHtmlReference);
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsDelayMs_2",
    () => DesignSystemTypeDeclarationsDelayMs_2,
    (value) => {
      DesignSystemTypeDeclarationsDelayMs_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsCache_5",
    () => DesignSystemTypeDeclarationsCache_5,
    (value) => {
      DesignSystemTypeDeclarationsCache_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsCache_6",
    () => DesignSystemTypeDeclarationsCache_6,
    (value) => {
      DesignSystemTypeDeclarationsCache_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsSubscribers_5",
    () => DesignSystemTypeDeclarationsSubscribers_5,
    (value) => {
      DesignSystemTypeDeclarationsSubscribers_5 = value;
    },
  );
  bindRuntimeValue(runtime, "scheduleHtmlUpload", () => scheduleHtmlUpload);
  bindRuntimeValue(runtime, "publishHtmlReference", () => publishHtmlReference);
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsGetLength",
    () => DesignSystemTypeDeclarationsGetLength,
    (value) => {
      DesignSystemTypeDeclarationsGetLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "knownHtmlReferenceState",
    () => knownHtmlReferenceState,
  );
  bindRuntimeValue(
    runtime,
    "sameOriginAssetFetcher",
    () => sameOriginAssetFetcher,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemsKey",
    () => DesignSystemsKey,
    (value) => {
      DesignSystemsKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsAZaZAZaZPattern",
    () => DesignSystemTypeDeclarationsAZaZAZaZPattern,
    (value) => {
      DesignSystemTypeDeclarationsAZaZAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsMax",
    () => DesignSystemTypeDeclarationsMax,
    (value) => {
      DesignSystemTypeDeclarationsMax = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsPadStart",
    () => DesignSystemTypeDeclarationsPadStart,
    (value) => {
      DesignSystemTypeDeclarationsPadStart = value;
    },
  );
  bindRuntimeValue(runtime, "cssColorNumber", () => cssColorNumber);
  bindRuntimeValue(runtime, "cssColorAngle", () => cssColorAngle);
  bindRuntimeValue(runtime, "parseColorFunction", () => parseColorFunction);
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsPow",
    () => DesignSystemTypeDeclarationsPow,
    (value) => {
      DesignSystemTypeDeclarationsPow = value;
    },
  );
  bindRuntimeValue(runtime, "oklabToCssRgb", () => oklabToCssRgb);
  bindRuntimeValue(runtime, "labToCssRgb", () => labToCssRgb);
  bindRuntimeValue(runtime, "normalizeCssColor", () => normalizeCssColor);
  bindRuntimeValue(
    runtime,
    "PaletteValue",
    () => PaletteValue,
    (value) => {
      PaletteValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsPattern",
    () => DesignSystemTypeDeclarationsPattern,
    (value) => {
      DesignSystemTypeDeclarationsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsRgbaHslaPattern",
    () => DesignSystemTypeDeclarationsRgbaHslaPattern,
    (value) => {
      DesignSystemTypeDeclarationsRgbaHslaPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sharedColorTokenPrefix",
    () => sharedColorTokenPrefix,
  );
  bindRuntimeValue(runtime, "colorTokenGroup", () => colorTokenGroup);
  bindRuntimeValue(runtime, "hasColorTokenGroup", () => hasColorTokenGroup);
  bindRuntimeValue(runtime, "groupColorTokens", () => groupColorTokens);
  bindRuntimeValue(
    runtime,
    "normalizeColorTokenName",
    () => normalizeColorTokenName,
  );
  bindRuntimeValue(
    runtime,
    "boundedDesignSystemText",
    () => boundedDesignSystemText,
  );
  bindRuntimeValue(runtime, "designSystemName", () => designSystemName);
  bindRuntimeValue(
    runtime,
    "createDesignSystemModel",
    () => createDesignSystemModel,
  );
  bindRuntimeValue(
    runtime,
    "colorTokenGroupLabels",
    () => colorTokenGroupLabels,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypeDeclarationsElementCache",
    () => DesignSystemTypeDeclarationsElementCache,
    (value) => {
      DesignSystemTypeDeclarationsElementCache = value;
    },
  );
  bindRuntimeValue(runtime, "hasSingleColorGroup", () => hasSingleColorGroup);
  bindRuntimeValue(
    runtime,
    "typographyGroupLabels",
    () => typographyGroupLabels,
  );
  bindRuntimeValue(
    runtime,
    "parseDesignSystemEntry",
    () => parseDesignSystemEntry,
  );
  bindRuntimeValue(runtime, "parseDesignSystems", () => parseDesignSystems);
  return () => {
    DesignSystemTypeDeclarationsRegistry = {};
    DesignSystemTypeDeclarationsAlias = "[]";
    DesignSystemTypeDeclarationsFailedValue = [];
    DesignSystemTypeDeclarationsResolvedValue = 0;
    DesignSystemTypeDeclarationsSubscribers = new Set();
    pendingFileOverlay = false;
    DesignSystemTypeDeclarationsItems = [3e3, 15e3, 6e4];
    DesignSystemTypeDeclarationsResolvedValue_2 = 5 * 6e4;
    DesignSystemTypeDeclarationsFailedValue_2 = [];
    DesignSystemTypeDeclarationsResolvedValue_3 = 0;
    DesignSystemTypeDeclarationsTextEncoder = new TextEncoder();
    DesignSystemTypeDeclarationsReduce = (): Dynamic =>
      Object.values(runtime.DesignSystemPublishedFilesFromEntriesValue).reduce(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input +
          DesignSystemTypeDeclarationsTextEncoder.encode(options).length,
        0,
      );
    DesignSystemTypeDeclarationsResolvedValue_4 = 2 * 1024 * 1024;
    ApplicationJsonValue = "application/json";
    DesignSystemTypeDeclarationsDelayMs = 15e3;
    DesignSystemTypeDeclarationsCache = new Map();
    DesignSystemTypeDeclarationsCache_2 = new Map();
    DesignSystemTypeDeclarationsSubscribers_2 = new Set();
    DesignSystemTypeDeclarationsCache_3 = new Map();
    DesignSystemTypeDeclarationsLimit = 6e4;
    DesignSystemTypeDeclarationsCache_4 = new Map();
    DesignSystemTypeDeclarationsSubscribers_3 = new Set();
    DesignSystemTypeDeclarationsSubscribers_4 = new Set();
    DesignSystemTypeDeclarationsReplace = (input?: Dynamic): Dynamic =>
      input.replace(/^\//, "");
    DesignSystemTypeDeclarationsGet = (input?: Dynamic): Dynamic => {
      let entry: Dynamic = DesignSystemTypeDeclarationsCache_3.get(input);
      return (
        entry !== undefined &&
        Date.now() - entry < DesignSystemTypeDeclarationsLimit
      );
    };
    DesignSystemTypeDeclarationsResolvedValue_5 = false;
    DesignSystemTypeDeclarationsDelayMs_2 = 800;
    DesignSystemTypeDeclarationsCache_5 = new Map();
    DesignSystemTypeDeclarationsCache_6 = new Map();
    DesignSystemTypeDeclarationsSubscribers_5 = new Set();
    DesignSystemTypeDeclarationsGetLength = (input?: Dynamic): Dynamic =>
      new TextEncoder().encode(input).length;
    DesignSystemsKey = "design-systems";
    DesignSystemTypeDeclarationsAZaZAZaZPattern =
      /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
    DesignSystemTypeDeclarationsMax = (input?: Dynamic): Dynamic =>
      Math.max(0, Math.min(1, input));
    DesignSystemTypeDeclarationsPadStart = (input?: Dynamic): Dynamic =>
      Math.round(DesignSystemTypeDeclarationsMax(input) * 255)
        .toString(16)
        .padStart(2, "0");
    DesignSystemTypeDeclarationsPow = (input?: Dynamic): Dynamic =>
      input <= 0.0031308
        ? 12.92 * input
        : 1.055 * Math.pow(input, 1 / 2.4) - 0.055;
    PaletteValue = "Palette";
    DesignSystemTypeDeclarationsPattern = /^(.*?)-\d{1,4}$/;
    DesignSystemTypeDeclarationsRgbaHslaPattern =
      /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgba?|hsla?|oklch|oklab|lab|lch|color)\([0-9a-z.,%/ \-]{1,60}\)|\{.+\})$/i;
    DesignSystemTypeDeclarationsElementCache = new WeakMap();
  };
}
