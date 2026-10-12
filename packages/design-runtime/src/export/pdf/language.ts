/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfLanguage(runtime: RuntimeBindings): () => void {
  var PdfLanguageItems: Dynamic;
  var PdfLanguageItems_2: Dynamic;
  var PdfLanguagePattern: Dynamic;
  var PdfLanguagePattern_2: Dynamic;
  var PdfLanguagePattern_3: Dynamic;
  var PdfLanguageScriptLatinPattern: Dynamic;
  var PdfLanguageAZaZAZaZPattern: Dynamic;
  var PdfLanguageItems_3: Dynamic;
  function detectTextLanguage(input?: Dynamic): Dynamic {
    let value: Dynamic = input.slice(0, 2e5),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        (value.match(input2) ?? []).length,
      value2: Dynamic = callback(/\p{L}/gu);
    if (value2 < 10) return;
    let [items, items2, items3]: Dynamic = [
        callback(PdfLanguagePattern),
        callback(PdfLanguagePattern_2),
        callback(PdfLanguagePattern_3),
      ],
      value3: Dynamic = value2 + 2 * (items + items2 + items3),
      callback2: Dynamic = (input2?: Dynamic, options: Dynamic = 1): Dynamic =>
        input2 * options * 2 > value3;
    if (callback2(items + items2, 3))
      return items >= 2 && items * 12 >= items + items2
        ? "ja"
        : items * 12 < items + items2 && items3 === 0
          ? "zh"
          : undefined;
    if (callback2(items3, 3)) return "ko";
    for (let [value5, value6] of PdfLanguageItems_2 as Dynamic)
      if (callback2(callback(value6))) return value5;
    if (!callback2(callback(PdfLanguageScriptLatinPattern))) return;
    let value4: Dynamic = [
        ...scoreLatinLanguages(value.toLowerCase().match(/\p{L}+/gu) ?? []),
      ].sort(
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          options[1] - input2[1],
      ),
      [items4, items5]: Dynamic = [value4[0], value4[1]];
    return items4[1] >= 5 && items4[1] >= 2 * items5[1] ? items4[0] : undefined;
  }
  function scoreLatinLanguages(input?: Dynamic): Dynamic {
    return PdfLanguageItems.map(([input2, input3]: Dynamic): Dynamic => {
      let values: Dynamic = new Set(input3.split(" "));
      return [
        input2,
        input.reduce(
          (input4?: Dynamic, options?: Dynamic): Dynamic =>
            input4 + (values.has(options) ? 1 : 0),
          0,
        ),
      ];
    });
  }
  function isLanguageTag(input?: Dynamic): Dynamic {
    return typeof input == "string" && PdfLanguageAZaZAZaZPattern.test(input);
  }
  function inferPdfLanguage(
    input?: Dynamic,
    options: Dynamic = (globalThis as Dynamic).navigator?.language,
  ): Dynamic {
    let value: Dynamic = detectTextLanguage(input);
    if (value !== undefined) return value;
    if (!isLanguageTag(options)) return "und";
    let [value2, ...value3]: Dynamic = options.toLowerCase().split("-"),
      value4: Dynamic = value3.find(
        (input2?: Dynamic): Dynamic => /^[a-z]{4}$/.test(input2),
      ),
      value5: Dynamic =
        value2 +
        (value4 === undefined
          ? ""
          : "-" + value4[0].toUpperCase() + value4.slice(1)),
      value6: Dynamic = input.slice(0, 2e5),
      length: Dynamic = (value6.match(/\p{L}/gu) ?? []).length;
    if (length < 10) return value5;
    for (let [value7, value8, value9] of PdfLanguageItems_3 as Dynamic) {
      let length2: Dynamic = (value6.match(value7) ?? []).filter(
        (input2?: Dynamic): Dynamic =>
          runtime.PdfTextEncodingPattern.test(input2),
      ).length;
      if (length2 * 2 <= length) continue;
      if (
        !(value4 !== undefined
          ? value8.toLowerCase().split(" ").includes(value4)
          : value9.split(" ").includes(value2)) ||
        (value2 === "en" &&
          (value6.match(/[A-Za-z]/g) ?? []).length * 40 < length2 * 39)
      )
        return "und";
      if (
        PdfLanguageItems.some(([input2]: Dynamic): Dynamic => input2 === value2)
      ) {
        let value10: Dynamic = value6.toLowerCase().match(/\p{L}+/gu) ?? [],
          value11: Dynamic = scoreLatinLanguages(value10),
          value12: Dynamic = value11.find(
            ([input2]: Dynamic): Dynamic => input2 === value2,
          )[1];
        if (
          value11.some(([, input2]: Dynamic): Dynamic => input2 > value12) ||
          (value10.length >= 30 && value12 * 16 < value10.length)
        )
          return "und";
      }
      return value5;
    }
    return "und";
  }
  bindRuntimeValue(
    runtime,
    "PdfLanguageItems",
    () => PdfLanguageItems,
    (value) => {
      PdfLanguageItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLanguageItems_2",
    () => PdfLanguageItems_2,
    (value) => {
      PdfLanguageItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLanguagePattern",
    () => PdfLanguagePattern,
    (value) => {
      PdfLanguagePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLanguagePattern_2",
    () => PdfLanguagePattern_2,
    (value) => {
      PdfLanguagePattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLanguagePattern_3",
    () => PdfLanguagePattern_3,
    (value) => {
      PdfLanguagePattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLanguageScriptLatinPattern",
    () => PdfLanguageScriptLatinPattern,
    (value) => {
      PdfLanguageScriptLatinPattern = value;
    },
  );
  bindRuntimeValue(runtime, "detectTextLanguage", () => detectTextLanguage);
  bindRuntimeValue(runtime, "scoreLatinLanguages", () => scoreLatinLanguages);
  bindRuntimeValue(
    runtime,
    "PdfLanguageAZaZAZaZPattern",
    () => PdfLanguageAZaZAZaZPattern,
    (value) => {
      PdfLanguageAZaZAZaZPattern = value;
    },
  );
  bindRuntimeValue(runtime, "isLanguageTag", () => isLanguageTag);
  bindRuntimeValue(
    runtime,
    "PdfLanguageItems_3",
    () => PdfLanguageItems_3,
    (value) => {
      PdfLanguageItems_3 = value;
    },
  );
  bindRuntimeValue(runtime, "inferPdfLanguage", () => inferPdfLanguage);
  return () => {
    PdfLanguageItems = [
      [
        "en",
        "the and of to in is for that with on are as be this by from at or an was it you your we our not have has will can",
      ],
      [
        "es",
        "de la el en y los las del que por con para una un es se no su al como m\xE1s lo sus este esta son",
      ],
      [
        "fr",
        "de la le les et des en du une un est pour que dans qui par sur au pas plus avec ce cette nous vous sont ne",
      ],
      [
        "de",
        "der die und das in den von zu mit ist f\xFCr auf dem des eine ein im nicht sich auch als an es wir sie werden bei oder",
      ],
      [
        "pt",
        "de da do em para com que os as uma um dos das n\xE3o por mais se na no ao como \xE9 s\xE3o seu sua",
      ],
      [
        "it",
        "di il la che in per del con le della un una dei \xE8 al non da sono alla pi\xF9 come gli delle nel questo",
      ],
      [
        "nl",
        "de het van een en in is op te voor met dat die zijn niet aan er om ook als bij door wordt deze dit wij",
      ],
    ];
    PdfLanguageItems_2 = [
      ["he", /(?=\p{L})[\u0590-\u05ff]/gu],
      ["th", /(?=\p{L})[\u0e00-\u0e7f]/gu],
      ["el", /(?=\p{L})[\u0370-\u03ff]/gu],
    ];
    PdfLanguagePattern = /(?=\p{L})[\u3040-\u30ff\uff66-\uff9f]/gu;
    PdfLanguagePattern_2 = /[\u3400-\u4dbf\u4e00-\u9fff]/gu;
    PdfLanguagePattern_3 = /(?=\p{L})[\uac00-\ud7a3\u1100-\u11ff]/gu;
    PdfLanguageScriptLatinPattern = /\p{Script=Latin}/gu;
    PdfLanguageAZaZAZaZPattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,3}$/;
    PdfLanguageItems_3 = [
      [
        /\p{Script=Latin}/gu,
        "Latn",
        "en es fr de pt it nl ca gl eu pl cs sk sl hu ro hr bs sq sv da nb nn no fi et lv lt is ga cy mt tr az uz tk id ms vi tl fil sw af zu xh yo ha so lb eo la",
      ],
      [/\p{Script=Cyrillic}/gu, "Cyrl", "ru uk be bg mk sr kk ky mn tg"],
      [/\p{Script=Arabic}/gu, "Arab", "ar fa ur ps ug sd ckb"],
      [/\p{Script=Devanagari}/gu, "Deva", "hi mr ne sa"],
      [/\p{Script=Bengali}/gu, "Beng", "bn as"],
      [/\p{Script=Gurmukhi}/gu, "Guru", "pa"],
      [/\p{Script=Gujarati}/gu, "Gujr", "gu"],
      [/\p{Script=Tamil}/gu, "Taml", "ta"],
      [/\p{Script=Telugu}/gu, "Telu", "te"],
      [/\p{Script=Kannada}/gu, "Knda", "kn"],
      [/\p{Script=Malayalam}/gu, "Mlym", "ml"],
      [/\p{Script=Sinhala}/gu, "Sinh", "si"],
      [/\p{Script=Thai}/gu, "Thai", "th"],
      [/\p{Script=Lao}/gu, "Laoo", "lo"],
      [/\p{Script=Khmer}/gu, "Khmr", "km"],
      [/\p{Script=Myanmar}/gu, "Mymr", "my"],
      [/\p{Script=Georgian}/gu, "Geor", "ka"],
      [/\p{Script=Armenian}/gu, "Armn", "hy"],
      [/\p{Script=Ethiopic}/gu, "Ethi", "am ti"],
      [/\p{Script=Hebrew}/gu, "Hebr", "he iw yi"],
      [/\p{Script=Greek}/gu, "Grek", "el"],
      [
        /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu,
        "Hani Hans Hant Jpan",
        "zh ja yue",
      ],
      [/\p{Script=Hangul}/gu, "Hang Kore", "ko"],
    ];
  };
}
