/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTypographyFontCatalog(
  runtime: RuntimeBindings,
): () => void {
  var builtInUtilityCss: Dynamic;
  var TypographyFontCatalogItems: Dynamic;
  var TypographyFontCatalogItems_2: Dynamic;
  var TypographyFontCatalogMapValue: Dynamic;
  var TypographyFontCatalogCache: Dynamic;
  var TypographyFontCatalogFromEntriesValue: Dynamic;
  var TypographyFontCatalogAZaZAZaZPattern: Dynamic;
  var TypographyFontCatalogSerifSansSerifPattern: Dynamic;
  function getKnownWebFont(input?: Dynamic): Dynamic {
    return TypographyFontCatalogCache.get(input.trim().toLowerCase());
  }
  function knownWebFontFamily(input?: Dynamic): Dynamic {
    return getKnownWebFont(input)?.family;
  }
  function buildGoogleFontsUrl(input?: Dynamic): Dynamic {
    let value: Dynamic = getKnownWebFont(input),
      value2: Dynamic = value
        ? ":wght@" + (value.weights ?? [400, 500, 600, 700]).join(";")
        : "";
    return (
      "https://fonts.googleapis.com/css2?family=" +
      (value?.family ?? input.trim()).replace(/ +/g, "+") +
      value2 +
      "&display=swap"
    );
  }
  function ensureWebFonts(input?: Dynamic, doc: Dynamic = document): Dynamic {
    for (let value of input as Dynamic) {
      if (
        TypographyFontCatalogSerifSansSerifPattern.test(value) ||
        !TypographyFontCatalogAZaZAZaZPattern.test(value)
      )
        continue;
      let value2: Dynamic = buildGoogleFontsUrl(value);
      if (doc.head.querySelector('link[href="' + value2 + '"]')) continue;
      let value3: Dynamic = doc.createElement("link");
      value3.rel = "stylesheet";
      value3.href = value2;
      doc.head.appendChild(value3);
    }
  }
  bindRuntimeValue(
    runtime,
    "builtInUtilityCss",
    () => builtInUtilityCss,
    (value) => {
      builtInUtilityCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontCatalogItems",
    () => TypographyFontCatalogItems,
    (value) => {
      TypographyFontCatalogItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontCatalogItems_2",
    () => TypographyFontCatalogItems_2,
    (value) => {
      TypographyFontCatalogItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontCatalogMapValue",
    () => TypographyFontCatalogMapValue,
    (value) => {
      TypographyFontCatalogMapValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontCatalogCache",
    () => TypographyFontCatalogCache,
    (value) => {
      TypographyFontCatalogCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontCatalogFromEntriesValue",
    () => TypographyFontCatalogFromEntriesValue,
    (value) => {
      TypographyFontCatalogFromEntriesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontCatalogAZaZAZaZPattern",
    () => TypographyFontCatalogAZaZAZaZPattern,
    (value) => {
      TypographyFontCatalogAZaZAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontCatalogSerifSansSerifPattern",
    () => TypographyFontCatalogSerifSansSerifPattern,
    (value) => {
      TypographyFontCatalogSerifSansSerifPattern = value;
    },
  );
  bindRuntimeValue(runtime, "getKnownWebFont", () => getKnownWebFont);
  bindRuntimeValue(runtime, "knownWebFontFamily", () => knownWebFontFamily);
  bindRuntimeValue(runtime, "buildGoogleFontsUrl", () => buildGoogleFontsUrl);
  bindRuntimeValue(runtime, "ensureWebFonts", () => ensureWebFonts);
  return () => {
    builtInUtilityCss =
      ".fx{display:flex}.col{display:flex;flex-direction:column}.grid{display:grid}.ac{align-items:center}.jc{justify-content:center}.jb{justify-content:space-between}.f1{flex:1}.noshrink{flex-shrink:0}.wrap{flex-wrap:wrap}.fw5{font-weight:500}.fw6{font-weight:600}.fw7{font-weight:700}.fw8{font-weight:800}.fs11{font-size:11px}.fs12{font-size:12px}.fs13{font-size:13px}.fs14{font-size:14px}.fs15{font-size:15px}.fs16{font-size:16px}.fs20{font-size:20px}.fs22{font-size:22px}.upper{text-transform:uppercase}.tc{text-align:center}.nowrap{white-space:nowrap}.gap8{gap:8px}.gap10{gap:10px}.gap12{gap:12px}.gap16{gap:16px}.gap24{gap:24px}.m0{margin:0}.mt8{margin-top:8px}.mt12{margin-top:12px}.mt16{margin-top:16px}.mb8{margin-bottom:8px}.mb12{margin-bottom:12px}.mb16{margin-bottom:16px}.posrel{position:relative}.posabs{position:absolute}.round{border-radius:50%}.ohide{overflow:hidden}.bbox{box-sizing:border-box}.pointer{cursor:pointer}.w100{width:100%}.b0{border:none}";
    TypographyFontCatalogItems = [
      {
        family: "Arial",
        generic: "sans",
      },
      {
        family: "Helvetica",
        generic: "sans",
      },
      {
        family: "Georgia",
        generic: "serif",
      },
      {
        family: "Times New Roman",
        generic: "serif",
      },
      {
        family: "Garamond",
        generic: "serif",
      },
      {
        family: "Courier New",
        generic: "mono",
      },
      {
        family: "Verdana",
        generic: "sans",
      },
      {
        family: "Tahoma",
        generic: "sans",
      },
      {
        family: "Trebuchet MS",
        generic: "sans",
      },
    ];
    TypographyFontCatalogItems_2 = [
      {
        family: "Inter",
        generic: "sans",
        wght: [100, 900],
        italic: true,
      },
      {
        family: "Roboto",
        generic: "sans",
        weights: [400, 500, 700],
        wght: [100, 900],
        italic: true,
      },
      {
        family: "Open Sans",
        generic: "sans",
        wght: [300, 800],
        italic: true,
      },
      {
        family: "Lato",
        generic: "sans",
        weights: [400, 700],
        statics: [100, 300, 400, 700, 900],
        italic: true,
      },
      {
        family: "Montserrat",
        generic: "sans",
        wght: [100, 900],
        italic: true,
      },
      {
        family: "Poppins",
        generic: "sans",
        statics: [100, 200, 300, 400, 500, 600, 700, 800, 900],
        italic: true,
      },
      {
        family: "Raleway",
        generic: "sans",
        wght: [100, 900],
        italic: true,
      },
      {
        family: "Nunito",
        generic: "sans",
        wght: [200, 1e3],
        italic: true,
      },
      {
        family: "Playfair Display",
        generic: "serif",
        wght: [400, 900],
        italic: true,
      },
      {
        family: "Merriweather",
        generic: "serif",
        weights: [400, 700],
        wght: [300, 900],
        italic: true,
      },
      {
        family: "Work Sans",
        generic: "sans",
        wght: [100, 900],
        italic: true,
      },
      {
        family: "DM Sans",
        generic: "sans",
        wght: [100, 1e3],
        italic: true,
      },
      {
        family: "Manrope",
        generic: "sans",
        wght: [200, 800],
        italic: false,
      },
      {
        family: "Space Grotesk",
        generic: "sans",
        wght: [300, 700],
        italic: false,
      },
      {
        family: "Lora",
        generic: "serif",
        wght: [400, 700],
        italic: true,
      },
      {
        family: "Bebas Neue",
        generic: "sans",
        weights: [400],
        statics: [400],
        italic: false,
      },
      {
        family: "Caveat",
        generic: "sans",
        wght: [400, 700],
        italic: false,
      },
    ];
    TypographyFontCatalogMapValue = TypographyFontCatalogItems_2.map(
      (input?: Dynamic): Dynamic => input.family,
    );
    TypographyFontCatalogCache = new Map(
      TypographyFontCatalogItems_2.map(
        (input?: Dynamic): Dynamic => [input.family.toLowerCase(), input],
      ),
    );
    TypographyFontCatalogFromEntriesValue = Object.fromEntries(
      TypographyFontCatalogItems_2.map(
        (input?: Dynamic): Dynamic => [
          input.family.toLowerCase(),
          {
            ...(input.wght !== undefined
              ? {
                  wght: input.wght,
                }
              : {
                  statics: input.statics ?? [400],
                }),
            italic: input.italic,
          },
        ],
      ),
    );
    TypographyFontCatalogAZaZAZaZPattern = /^[A-Za-z0-9][A-Za-z0-9 ]*$/;
    TypographyFontCatalogSerifSansSerifPattern =
      /^(?:ui-)?(?:serif|sans-serif|monospace|rounded|cursive|fantasy|system-ui|math|emoji|fangsong)$/;
  };
}
